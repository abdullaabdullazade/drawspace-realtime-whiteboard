import {
  Controller, Get, Post, Delete, Patch, Body,
  Param, UseGuards,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CreateBoardDto } from './dto/create-board.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { AddElementDto } from './dto/add-element.dto';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private boardsService: BoardsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateBoardDto) {
    return this.boardsService.create(user.id, dto);
  }

  @Get()
  myBoards(@CurrentUser() user: User) {
    return this.boardsService.findMyBoards(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.boardsService.findOne(id, user.id);
  }

  // Public read — no auth. Only returns the board if it is public.
  @Public()
  @Get(':id/public')
  findPublic(@Param('id') id: string) {
    return this.boardsService.findPublicBoard(id);
  }

  @Post(':id/invite')
  invite(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: { email: string },
  ) {
    return this.boardsService.inviteByEmail(id, user.id, dto.email);
  }

  @Patch(':id')
  updateBoard(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: { name?: string; description?: string; isPublic?: boolean },
  ) {
    return this.boardsService.updateBoard(id, user.id, dto);
  }

  @Delete(':id')
  deleteBoard(@Param('id') id: string, @CurrentUser() user: User) {
    return this.boardsService.deleteBoard(id, user.id);
  }

  @Get('trash/list')
  trashed(@CurrentUser() user: User) {
    return this.boardsService.findTrashed(user.id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: User) {
    return this.boardsService.restoreBoard(id, user.id);
  }

  @Delete(':id/permanent')
  permanent(@Param('id') id: string, @CurrentUser() user: User) {
    return this.boardsService.permanentDelete(id, user.id);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: AddMemberDto,
  ) {
    return this.boardsService.addMember(id, user.id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') boardId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: User,
  ) {
    return this.boardsService.removeMember(boardId, user.id, targetUserId);
  }

  @Post(':id/elements')
  addElement(
    @Param('id') boardId: string,
    @CurrentUser() user: User,
    @Body() dto: AddElementDto,
  ) {
    return this.boardsService.addElement(boardId, user.id, dto);
  }

  @Patch(':id/elements/:elementId')
  updateElement(
    @Param('id') boardId: string,
    @Param('elementId') elementId: string,
    @CurrentUser() user: User,
    @Body() body: { data: Record<string, unknown> },
  ) {
    return this.boardsService.updateElement(boardId, elementId, user.id, body.data);
  }

  @Delete(':id/elements/:elementId')
  removeElement(
    @Param('id') boardId: string,
    @Param('elementId') elementId: string,
    @CurrentUser() user: User,
  ) {
    return this.boardsService.removeElement(boardId, elementId, user.id);
  }
}
