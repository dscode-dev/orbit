import { ValidationException } from '../../exceptions';
import { ChecklistItemType } from './checklist.dto';
import { ChecklistService } from './checklist.service';

describe('ChecklistService', () => {
  const repository = {
    createTemplate: jest.fn(),
  };
  const service = new ChecklistService(repository as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('normalizes template keys and item keys', async () => {
    repository.createTemplate.mockResolvedValue({ id: 'template' });
    await service.createTemplate('org', {
      key: ' preventive ',
      name: 'Preventive',
      items: [
        {
          key: ' Pressure ',
          label: 'Pressure',
          type: ChecklistItemType.NUMBER,
          required: true,
        },
      ],
    });
    expect(repository.createTemplate).toHaveBeenCalledWith(
      'org',
      expect.objectContaining({
        key: 'PREVENTIVE',
        items: [expect.objectContaining({ key: 'pressure' })],
      }),
    );
  });

  it('rejects a select item without options', () => {
    expect(() =>
      service.createTemplate('org', {
        key: 'inspection',
        name: 'Inspection',
        items: [
          {
            key: 'result',
            label: 'Result',
            type: ChecklistItemType.SELECT,
          },
        ],
      }),
    ).toThrow(ValidationException);
  });
});
