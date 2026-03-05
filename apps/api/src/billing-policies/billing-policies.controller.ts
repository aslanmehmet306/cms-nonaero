import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@shared-types/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { Audit } from '../common/decorators/audit.decorator';
import { BillingPoliciesService } from './billing-policies.service';
import { CreateBillingPolicyDto } from './dto/create-billing-policy.dto';
import { UpdateBillingPolicyDto } from './dto/update-billing-policy.dto';

@ApiTags('Billing Policies')
@ApiBearerAuth()
@Controller('billing-policies')
export class BillingPoliciesController {
  constructor(private readonly billingPoliciesService: BillingPoliciesService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get the currently active billing policy for an airport' })
  @ApiQuery({ name: 'airportId', required: true, description: 'Airport ID' })
  @ApiResponse({ status: 200, description: 'Active billing policy or null' })
  findActive(@Query('airportId') airportId: string) {
    return this.billingPoliciesService.findActive(airportId);
  }

  @Get()
  @ApiOperation({ summary: 'List all billing policies for an airport' })
  @ApiQuery({ name: 'airportId', required: true, description: 'Airport ID' })
  @ApiResponse({ status: 200, description: 'Billing policy list ordered by version desc' })
  findAll(@Query('airportId') airportId: string) {
    return this.billingPoliciesService.findAll(airportId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get billing policy by ID' })
  @ApiResponse({ status: 200, description: 'Billing policy details' })
  @ApiResponse({ status: 404, description: 'Billing policy not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingPoliciesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.airport_admin, UserRole.super_admin)
  @Audit('BillingPolicy')
  @ApiOperation({ summary: 'Create a new billing policy (status=draft)' })
  @ApiResponse({ status: 201, description: 'Billing policy created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  create(@Body() dto: CreateBillingPolicyDto) {
    return this.billingPoliciesService.create(dto);
  }

  @Patch(':id')
  @Audit('BillingPolicy')
  @ApiOperation({ summary: 'Update draft or approved billing policy' })
  @ApiResponse({ status: 200, description: 'Billing policy updated' })
  @ApiResponse({ status: 400, description: 'Active/archived policies cannot be updated' })
  @ApiResponse({ status: 404, description: 'Billing policy not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBillingPolicyDto) {
    return this.billingPoliciesService.update(id, dto);
  }

  @Post(':id/approve')
  @Roles(UserRole.airport_admin, UserRole.super_admin)
  @Audit('BillingPolicy')
  @ApiOperation({ summary: 'Approve a billing policy' })
  @ApiResponse({ status: 201, description: 'Billing policy approved' })
  @ApiResponse({ status: 404, description: 'Billing policy not found' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { sub: string } }) {
    return this.billingPoliciesService.approve(id, req.user.sub);
  }

  @Post(':id/activate')
  @Roles(UserRole.airport_admin, UserRole.super_admin)
  @Audit('BillingPolicy')
  @ApiOperation({ summary: 'Activate a billing policy (archives previous active policy atomically)' })
  @ApiResponse({ status: 201, description: 'Billing policy activated' })
  @ApiResponse({ status: 404, description: 'Billing policy not found' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.billingPoliciesService.activate(id);
  }
}
