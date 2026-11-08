import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentIdentity } from '../identity/current-identity.decorator';
import type { Identity } from '../identity/identity';
import { DemandesService } from './demandes.service';
import { CreateDemandeDto } from './dto/create-demande.dto';
import { FilterDemandeDto } from './dto/filter-demande.dto';
import { UpdateDemandeStatutDto } from './dto/update-demande-statut.dto';
import { DemandeHebergement } from './entities/demande-hebergement.entity';

@ApiTags('Demandes')
@Controller('demandes')
export class DemandesController {
  constructor(private readonly demandesService: DemandesService) {}

  @Post()
  @ApiOperation({ summary: 'Deposer une demande d hebergement (etudiant)' })
  @ApiCreatedResponse({ type: DemandeHebergement })
  create(
    @Body() dto: CreateDemandeDto,
    @CurrentIdentity() identity?: Identity,
  ): Promise<DemandeHebergement> {
    return this.demandesService.create(dto, identity);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les demandes (admin : toutes ; etudiant : les siennes)',
  })
  @ApiOkResponse({ type: DemandeHebergement, isArray: true })
  findAll(
    @Query() filter: FilterDemandeDto,
    @CurrentIdentity() identity?: Identity,
  ): Promise<DemandeHebergement[]> {
    return this.demandesService.findAll(filter, identity);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Recuperer une demande par id (proprietaire ou admin)',
  })
  @ApiOkResponse({ type: DemandeHebergement })
  @ApiNotFoundResponse({ description: 'Demande introuvable' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentIdentity() identity?: Identity,
  ): Promise<DemandeHebergement> {
    return this.demandesService.findOne(id, identity);
  }

  @Patch(':id/statut')
  @ApiOperation({
    summary:
      'Changer le statut (approbation : occupe la chambre et declenche la creation du contrat via RabbitMQ)',
  })
  @ApiOkResponse({ type: DemandeHebergement })
  @ApiNotFoundResponse({ description: 'Demande introuvable' })
  @ApiConflictResponse({
    description: 'Transition non autorisee ou chambre deja occupee',
  })
  updateStatut(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDemandeStatutDto,
    @CurrentIdentity() identity?: Identity,
  ): Promise<DemandeHebergement> {
    return this.demandesService.updateStatut(id, dto, identity);
  }
}
