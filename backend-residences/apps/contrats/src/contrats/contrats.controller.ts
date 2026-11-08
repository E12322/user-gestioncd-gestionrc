import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ContratsService } from './contrats.service';
import { FilterContratDto } from './dto/filter-contrat.dto';
import { FindResidentContratsDto } from './dto/find-resident-contrats.dto';
import { Contrat } from './entities/contrat.entity';

@ApiTags('Contrats')
@Controller('contrats')
export class ContratsController {
  constructor(private readonly contratsService: ContratsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les contrats (vue admin, filtres optionnels)',
  })
  @ApiOkResponse({ type: Contrat, isArray: true })
  findAll(@Query() filter: FilterContratDto): Promise<Contrat[]> {
    return this.contratsService.findAll(filter);
  }

  @Get('resident/:residentId')
  @ApiOperation({ summary: 'Lister les contrats d un resident' })
  @ApiOkResponse({ type: Contrat, isArray: true })
  findByResident(
    @Param('residentId') residentId: string,
    @Query() filter: FindResidentContratsDto,
  ): Promise<Contrat[]> {
    return this.contratsService.findByResident(residentId, filter.statut);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Recuperer un contrat par id' })
  @ApiOkResponse({ type: Contrat })
  @ApiNotFoundResponse({ description: 'Contrat introuvable' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Contrat> {
    return this.contratsService.findOne(id);
  }

  @Patch(':id/resilier')
  @ApiOperation({
    summary: 'Resilier un contrat actif (libere aussi la chambre)',
  })
  @ApiOkResponse({ type: Contrat })
  @ApiNotFoundResponse({ description: 'Contrat introuvable' })
  @ApiConflictResponse({ description: 'Le contrat n est pas actif' })
  resilier(@Param('id', new ParseUUIDPipe()) id: string): Promise<Contrat> {
    return this.contratsService.resilier(id);
  }
}
