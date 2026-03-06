import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Audit } from '../common/decorators/audit.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { UpdateExchangeRateDto } from './dto/update-exchange-rate.dto';
import { QueryExchangeRatesDto } from './dto/query-exchange-rates.dto';

/**
 * ExchangeRatesController — CRUD for exchange rates plus rate lookup.
 *
 * Endpoints:
 *   POST   /exchange-rates         — create exchange rate
 *   GET    /exchange-rates         — list (paginated, filterable)
 *   GET    /exchange-rates/lookup  — effective date rate lookup
 *   GET    /exchange-rates/:id     — get by ID
 *   PATCH  /exchange-rates/:id     — update mutable fields
 *   DELETE /exchange-rates/:id     — remove
 */
@ApiTags('Exchange Rates')
@ApiBearerAuth()
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
  )
  @Audit('ExchangeRate')
  @ApiOperation({ summary: 'Create a new exchange rate entry' })
  @ApiResponse({ status: 201, description: 'Exchange rate created' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate entry' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateExchangeRateDto) {
    return this.exchangeRatesService.create(dto);
  }

  @Get()
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
    UserRole.commercial_manager,
  )
  @ApiOperation({ summary: 'List exchange rates with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated exchange rate list' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  findAll(@Query() query: QueryExchangeRatesDto) {
    return this.exchangeRatesService.findAll(query);
  }

  @Get('lookup')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
    UserRole.commercial_manager,
  )
  @ApiOperation({
    summary: 'Look up effective exchange rate for a currency pair on a given date',
  })
  @ApiQuery({ name: 'fromCurrency', required: true, type: String, description: 'Source currency (e.g. EUR)' })
  @ApiQuery({ name: 'toCurrency', required: true, type: String, description: 'Target currency (e.g. TRY)' })
  @ApiQuery({ name: 'effectiveDate', required: true, type: String, description: 'ISO date string (e.g. 2026-03-15)' })
  @ApiResponse({ status: 200, description: 'Effective rate for the currency pair' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'No rate found for the given pair and date' })
  lookup(
    @Query('fromCurrency') fromCurrency: string,
    @Query('toCurrency') toCurrency: string,
    @Query('effectiveDate') effectiveDate: string,
  ) {
    return this.exchangeRatesService.getRate(
      fromCurrency,
      toCurrency,
      new Date(effectiveDate),
    );
  }

  @Get(':id')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
    UserRole.auditor,
  )
  @ApiOperation({ summary: 'Get exchange rate by ID' })
  @ApiResponse({ status: 200, description: 'Exchange rate details' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.exchangeRatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    UserRole.finance,
    UserRole.airport_admin,
    UserRole.super_admin,
  )
  @Audit('ExchangeRate')
  @ApiOperation({ summary: 'Update exchange rate (rate, notes, source only)' })
  @ApiResponse({ status: 200, description: 'Exchange rate updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExchangeRateDto,
  ) {
    return this.exchangeRatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(
    UserRole.airport_admin,
    UserRole.super_admin,
  )
  @Audit('ExchangeRate')
  @ApiOperation({ summary: 'Delete an exchange rate entry' })
  @ApiResponse({ status: 200, description: 'Exchange rate deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.exchangeRatesService.remove(id);
  }
}
