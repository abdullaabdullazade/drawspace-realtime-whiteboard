import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board } from './entities/board.entity';
import { BoardMember, MemberRole } from './entities/board-member.entity';
import { CanvasElement } from './entities/canvas-element.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddElementDto } from './dto/add-element.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class BoardsService {
  constructor(
    @InjectRepository(Board) private boardsRepo: Repository<Board>,
    @InjectRepository(BoardMember) private membersRepo: Repository<BoardMember>,
    @InjectRepository(CanvasElement) private elementsRepo: Repository<CanvasElement>,
    private usersService: UsersService,
  ) {}

  // Invite a user to a board by email
  async inviteByEmail(boardId: string, requesterId: string, email: string, role: MemberRole = MemberRole.EDITOR) {
    await this.assertRole(boardId, requesterId, [MemberRole.OWNER]);
    const user = await this.usersService.findByEmail(email.trim().toLowerCase());
    if (!user) throw new NotFoundException('No user with that email');
    if (user.id === requesterId) throw new ForbiddenException('You are already the owner');

    const existing = await this.membersRepo.findOne({ where: { boardId, userId: user.id } });
    if (existing) {
      return { message: `${user.username} is already a member`, alreadyMember: true };
    }
    await this.membersRepo.save({ boardId, userId: user.id, role });
    return { message: `Invited ${user.username}`, user: { id: user.id, username: user.username, email: user.email } };
  }

  async create(userId: string, dto: CreateBoardDto): Promise<Board> {
    const board = this.boardsRepo.create({ ...dto, ownerId: userId });
    const saved = await this.boardsRepo.save(board);

    await this.membersRepo.save({
      boardId: saved.id,
      userId,
      role: MemberRole.OWNER,
    });

    return saved;
  }

  async findMyBoards(userId: string): Promise<Board[]> {
    const memberships = await this.membersRepo.find({ where: { userId } });
    const boardIds = memberships.map((m) => m.boardId);
    if (!boardIds.length) return [];

    const boards = await this.boardsRepo
      .createQueryBuilder('board')
      .leftJoinAndSelect('board.owner', 'owner')
      .where('board.id IN (:...ids)', { ids: boardIds })
      .andWhere('board.isTrashed = false')
      .select(['board', 'owner.id', 'owner.username', 'owner.email'])
      .orderBy('board.updatedAt', 'DESC')
      .getMany();

    // Member count per board (single grouped query)
    const counts = await this.membersRepo
      .createQueryBuilder('m')
      .select('m.boardId', 'boardId')
      .addSelect('COUNT(*)', 'count')
      .where('m.boardId IN (:...ids)', { ids: boardIds })
      .groupBy('m.boardId')
      .getRawMany<{ boardId: string; count: string }>();

    const countMap = new Map(counts.map((c) => [c.boardId, parseInt(c.count, 10)]));
    for (const board of boards) {
      board.memberCount = countMap.get(board.id) ?? 0;
    }

    return boards;
  }

  async findOne(boardId: string, userId: string): Promise<Board> {
    await this.assertAccess(boardId, userId);

    const board = await this.boardsRepo
      .createQueryBuilder('board')
      .leftJoinAndSelect('board.elements', 'elements')
      .leftJoinAndSelect('board.members', 'members')
      .leftJoinAndSelect('members.user', 'memberUser')
      .where('board.id = :boardId', { boardId })
      .select([
        'board',
        'elements',
        'members',
        'memberUser.id',
        'memberUser.username',
      ])
      .getOne();

    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  // Public board read — no auth. Anyone can open/edit a public board.
  async findPublicBoard(boardId: string): Promise<Board> {
    const board = await this.boardsRepo
      .createQueryBuilder('board')
      .leftJoinAndSelect('board.elements', 'elements')
      .leftJoinAndSelect('board.owner', 'owner')
      .where('board.id = :boardId', { boardId })
      .select(['board', 'elements', 'owner.id', 'owner.username'])
      .getOne();
    if (!board) throw new NotFoundException('Board not found');
    if (!board.isPublic) throw new ForbiddenException('This board is private');
    return board;
  }

  // Persist an element drawn by an anonymous guest on a public board
  async addGuestElement(boardId: string, dto: AddElementDto): Promise<CanvasElement> {
    const board = await this.boardsRepo.findOne({ where: { id: boardId } });
    if (!board) throw new NotFoundException('Board not found');
    if (!board.isPublic) throw new ForbiddenException('Board is not public');
    const el = this.elementsRepo.create({ ...dto, boardId, createdById: null });
    return this.elementsRepo.save(el);
  }

  async addMember(boardId: string, requesterId: string, dto: AddMemberDto) {
    await this.assertRole(boardId, requesterId, [MemberRole.OWNER]);
    const existing = await this.membersRepo.findOne({
      where: { boardId, userId: dto.userId },
    });
    if (existing) {
      existing.role = dto.role;
      return this.membersRepo.save(existing);
    }
    return this.membersRepo.save({ boardId, userId: dto.userId, role: dto.role });
  }

  async removeMember(boardId: string, requesterId: string, targetUserId: string) {
    await this.assertRole(boardId, requesterId, [MemberRole.OWNER]);
    await this.membersRepo.delete({ boardId, userId: targetUserId });
    return { message: 'Member removed' };
  }

  async addElement(boardId: string, userId: string, dto: AddElementDto): Promise<CanvasElement> {
    await this.assertAccess(boardId, userId);
    const el = this.elementsRepo.create({ ...dto, boardId, createdById: userId });
    return this.elementsRepo.save(el);
  }

  async updateElement(
    boardId: string,
    elementId: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<CanvasElement> {
    await this.assertAccess(boardId, userId);
    const el = await this.elementsRepo.findOne({ where: { id: elementId, boardId } });
    if (!el) throw new NotFoundException('Element not found');
    el.data = data;
    return this.elementsRepo.save(el);
  }

  async removeElement(boardId: string, elementId: string, userId: string) {
    await this.assertAccess(boardId, userId);
    await this.elementsRepo.delete({ id: elementId, boardId });
    return { message: 'Element deleted' };
  }

  async updateBoard(
    boardId: string,
    userId: string,
    dto: { name?: string; description?: string; isPublic?: boolean },
  ): Promise<Board> {
    await this.assertRole(boardId, userId, [MemberRole.OWNER]);
    const board = await this.boardsRepo.findOne({ where: { id: boardId } });
    if (!board) throw new NotFoundException('Board not found');
    if (dto.name !== undefined) board.name = dto.name;
    if (dto.description !== undefined) board.description = dto.description;
    if (dto.isPublic !== undefined) board.isPublic = dto.isPublic;
    return this.boardsRepo.save(board);
  }

  // Soft delete → move to trash
  async deleteBoard(boardId: string, userId: string) {
    await this.assertRole(boardId, userId, [MemberRole.OWNER]);
    await this.boardsRepo.update(boardId, { isTrashed: true });
    return { message: 'Board moved to trash' };
  }

  async findTrashed(userId: string): Promise<Board[]> {
    const memberships = await this.membersRepo.find({ where: { userId } });
    const boardIds = memberships.map((m) => m.boardId);
    if (!boardIds.length) return [];
    return this.boardsRepo
      .createQueryBuilder('board')
      .leftJoinAndSelect('board.owner', 'owner')
      .where('board.id IN (:...ids)', { ids: boardIds })
      .andWhere('board.isTrashed = true')
      .select(['board', 'owner.id', 'owner.username', 'owner.email'])
      .orderBy('board.updatedAt', 'DESC')
      .getMany();
  }

  async restoreBoard(boardId: string, userId: string) {
    await this.assertRole(boardId, userId, [MemberRole.OWNER]);
    await this.boardsRepo.update(boardId, { isTrashed: false });
    return { message: 'Board restored' };
  }

  // Permanent delete (from trash)
  async permanentDelete(boardId: string, userId: string) {
    await this.assertRole(boardId, userId, [MemberRole.OWNER]);
    await this.boardsRepo.delete(boardId);
    return { message: 'Board permanently deleted' };
  }

  async assertAccess(boardId: string, userId: string) {
    const board = await this.boardsRepo.findOne({ where: { id: boardId } });
    if (!board) throw new NotFoundException('Board not found');
    // Anonymous guests (non-UUID id) can access public boards only — skip member lookup
    const isGuest = !userId || userId.startsWith('guest:');
    const member = isGuest ? null : await this.membersRepo.findOne({ where: { boardId, userId } });
    if (!board.isPublic && !member) throw new ForbiddenException('No access to this board');
    return member;
  }

  private async assertRole(boardId: string, userId: string, roles: MemberRole[]) {
    const member = await this.membersRepo.findOne({ where: { boardId, userId } });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
