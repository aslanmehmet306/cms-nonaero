import { Injectable } from '@nestjs/common';
import { DeclarationsService } from './declarations.service';
import { CreateDeclarationLineDto } from './dto/create-declaration-line.dto';

/**
 * DeclarationLinesService — thin wrapper delegating to DeclarationsService.
 * Provides a clean dependency injection target for the controller.
 */
@Injectable()
export class DeclarationLinesService {
  constructor(private readonly declarationsService: DeclarationsService) {}

  create(declarationId: string, dto: CreateDeclarationLineDto) {
    return this.declarationsService.createLine(declarationId, dto);
  }

  findByDeclaration(declarationId: string) {
    return this.declarationsService.findLinesByDeclaration(declarationId);
  }

  update(lineId: string, dto: Partial<CreateDeclarationLineDto>) {
    return this.declarationsService.updateLine(lineId, dto);
  }

  remove(lineId: string) {
    return this.declarationsService.removeLine(lineId);
  }
}
