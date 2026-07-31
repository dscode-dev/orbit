import { Injectable } from '@nestjs/common';
import type { CreateEventDto } from './dto/scheduling.dto';
import { SchedulingService } from './scheduling.service';

export const SCHEDULING_EVENT_PUBLISHER = Symbol('SCHEDULING_EVENT_PUBLISHER');

export type PublishSchedulingEventCommand = {
  organizationId: string;
  actorId: string;
  event: CreateEventDto;
};

export interface SchedulingEventPublisher {
  publish(command: PublishSchedulingEventCommand): Promise<{ id: string }>;
}

@Injectable()
export class SchedulingEventPublisherAdapter implements SchedulingEventPublisher {
  constructor(private readonly scheduling: SchedulingService) {}

  async publish(command: PublishSchedulingEventCommand) {
    const event = await this.scheduling.createEvent(
      command.organizationId,
      command.actorId,
      command.event,
    );
    return { id: event.id };
  }
}
