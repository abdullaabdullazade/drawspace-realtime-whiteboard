import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Board } from './board.entity';
import { User } from '../../users/entities/user.entity';

export enum ElementType {
  PATH = 'path',
  SHAPE = 'shape',
  TEXT = 'text',
  IMAGE = 'image',
}

@Entity('canvas_elements')
export class CanvasElement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  boardId: string;

  @Column({ nullable: true })
  createdById: string | null;

  @Column({ type: 'enum', enum: ElementType })
  type: ElementType;

  @Column({ type: 'jsonb' })
  data: Record<string, unknown>;

  @Column({ nullable: true })
  layer: number;

  @ManyToOne(() => Board, (b) => b.elements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'boardId' })
  board: Board;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
