import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class HashingService {
  constructor(private readonly configService: ConfigService) {}

  get argon2Options(): argon2.Options {
    return {
      type: argon2.argon2id,
      memoryCost: this.configService.get<number>('security.argon2.memoryCost', 65536),
      timeCost: this.configService.get<number>('security.argon2.timeCost', 3),
      parallelism: this.configService.get<number>('security.argon2.parallelism', 4),
    };
  }

  async hash(data: string): Promise<string> {
    return argon2.hash(data, this.argon2Options);
  }

  async verify(hash: string, data: string): Promise<boolean> {
    return argon2.verify(hash, data);
  }
}
