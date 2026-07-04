import { IsString, IsEnum } from 'class-validator';
import { MemberRole } from '../entities/board-member.entity';

export class AddMemberDto {
  @IsString()
  userId!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}
