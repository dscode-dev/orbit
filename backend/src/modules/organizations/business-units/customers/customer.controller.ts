import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../../decorators';
import { ForbiddenException } from '../../../../exceptions';
import { ParseUUIDv7Pipe } from '../../../../pipes';
import type { IdentityRequest } from '../../../identity/infrastructure/jwt-authentication.guard';
import {
  Capabilities,
  RequiresActivePlan,
} from '../../../subscription-plans/plan-access';
import {
  CreateContactDto,
  CreateCustomerDto,
  CustomerQueryDto,
  UpdateContactDto,
  UpdateCustomerDto,
} from './customer.dto';
import { CustomerService } from './customer.service';

@ApiTags('Customers')
@Controller('customers')
@RequiresActivePlan()
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get()
  @Capabilities('crm.read')
  @Permissions('customers.read')
  list(@Req() request: IdentityRequest, @Query() query: CustomerQueryDto) {
    return this.customers.list(this.organizationId(request), query);
  }

  @Get(':id')
  @Capabilities('crm.read')
  @Permissions('customers.read')
  get(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.customers.get(id, this.organizationId(request));
  }

  @Post()
  @Capabilities('crm.manage')
  @Permissions('customers.create')
  create(@Req() request: IdentityRequest, @Body() input: CreateCustomerDto) {
    return this.customers.create(this.organizationId(request), input);
  }

  @Patch(':id')
  @Capabilities('crm.manage')
  @Permissions('customers.update')
  update(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateCustomerDto,
  ) {
    return this.customers.update(id, this.organizationId(request), input);
  }

  @Delete(':id')
  @Capabilities('crm.manage')
  @Permissions('customers.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.customers.remove(id, this.organizationId(request));
  }

  @Get(':id/contacts')
  @Capabilities('crm.read')
  @Permissions('contacts.read')
  contacts(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
  ) {
    return this.customers.listContacts(id, this.organizationId(request));
  }

  @Post(':id/contacts')
  @Capabilities('crm.manage')
  @Permissions('contacts.create')
  createContact(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Req() request: IdentityRequest,
    @Body() input: CreateContactDto,
  ) {
    return this.customers.createContact(
      id,
      this.organizationId(request),
      input,
    );
  }

  @Patch(':id/contacts/:contactId')
  @Capabilities('crm.manage')
  @Permissions('contacts.update')
  updateContact(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('contactId', ParseUUIDv7Pipe) contactId: string,
    @Req() request: IdentityRequest,
    @Body() input: UpdateContactDto,
  ) {
    return this.customers.updateContact(
      contactId,
      id,
      this.organizationId(request),
      input,
    );
  }

  @Delete(':id/contacts/:contactId')
  @Capabilities('crm.manage')
  @Permissions('contacts.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(
    @Param('id', ParseUUIDv7Pipe) id: string,
    @Param('contactId', ParseUUIDv7Pipe) contactId: string,
    @Req() request: IdentityRequest,
  ) {
    return this.customers.removeContact(
      contactId,
      id,
      this.organizationId(request),
    );
  }

  private organizationId(request: IdentityRequest): string {
    const id = request.identity?.organizationId;
    if (!id) throw new ForbiddenException('Organization context is required');
    return id;
  }
}
