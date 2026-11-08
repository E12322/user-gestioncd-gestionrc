import { PartialType } from '@nestjs/swagger';
import { CreateChambreDto } from './create-chambre.dto';

export class UpdateChambreDto extends PartialType(CreateChambreDto) {}
