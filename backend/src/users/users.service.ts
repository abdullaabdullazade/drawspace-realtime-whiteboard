import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async create(email: string, username: string, password: string): Promise<User> {
    const exists = await this.usersRepo.findOne({
      where: [{ email }, { username }],
    });
    if (exists) throw new ConflictException('Email or username already taken');

    const hashed = await bcrypt.hash(password, 12);
    const user = this.usersRepo.create({ email, username, password: hashed });
    return this.usersRepo.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }
}
