import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ChambresService } from './chambres.service';
import { Chambre } from './entities/chambre.entity';
import { CreateChambreDto } from './dto/create-chambre.dto';
import { UpdateChambreDto } from './dto/update-chambre.dto';
import { FilterChambreDto } from './dto/filter-chambre.dto';

@ApiTags('Chambres')
@Controller('chambres')
export class ChambresController {
  constructor(private readonly chambresService: ChambresService) {}

  @Post()
  @ApiOperation({ summary: 'Creer une chambre' })
  @ApiCreatedResponse({ type: Chambre })
  create(@Body() dto: CreateChambreDto): Promise<Chambre> {
    return this.chambresService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les chambres (filtres optionnels)' })
  @ApiOkResponse({ type: Chambre, isArray: true })
  findAll(@Query() filter: FilterChambreDto): Promise<Chambre[]> {
    return this.chambresService.findAll(filter);
  }

  @Get('disponibles')
  @ApiOperation({ summary: 'Lister uniquement les chambres disponibles' })
  @ApiOkResponse({ type: Chambre, isArray: true })
  findDisponibles(@Query() filter: FilterChambreDto): Promise<Chambre[]> {
    return this.chambresService.findDisponibles(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Recuperer une chambre par id' })
  @ApiOkResponse({ type: Chambre })
  @ApiNotFoundResponse({ description: 'Chambre introuvable' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Chambre> {
    return this.chambresService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre a jour une chambre' })
  @ApiOkResponse({ type: Chambre })
  @ApiNotFoundResponse({ description: 'Chambre introuvable' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateChambreDto,
  ): Promise<Chambre> {
    return this.chambresService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une chambre' })
  @ApiNoContentResponse({ description: 'Chambre supprimee' })
  @ApiNotFoundResponse({ description: 'Chambre introuvable' })
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.chambresService.remove(id);
  }

  // ---------------------------------------------------------------------
  // Endpoints internes : appeles par les services Demandes et Contrats
  // (occupation atomique d'une chambre, liberation idempotente).
  // ---------------------------------------------------------------------

  @Post(':id/occuper')
  @ApiOperation({
    summary:
      'Occuper atomiquement une chambre libre (interne : approbation Demande, retourne 409 si deja occupee)',
  })
  @ApiOkResponse({ type: Chambre })
  @ApiNotFoundResponse({ description: 'Chambre introuvable' })
  @ApiConflictResponse({ description: 'Chambre deja occupee' })
  occuper(@Param('id', new ParseUUIDPipe()) id: string): Promise<Chambre> {
    return this.chambresService.occuper(id);
  }

  @Post(':id/liberer')
  @ApiOperation({
    summary:
      'Liberer une chambre (interne : annulation Demande, resiliation Contrat)',
  })
  @ApiOkResponse({ type: Chambre })
  @ApiNotFoundResponse({ description: 'Chambre introuvable' })
  liberer(@Param('id', new ParseUUIDPipe()) id: string): Promise<Chambre> {
    return this.chambresService.liberer(id);
  }
}
