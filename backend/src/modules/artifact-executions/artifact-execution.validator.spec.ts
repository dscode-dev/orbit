import { ValidationException } from '../../exceptions';
import { ArtifactExecutionValidator } from './artifact-execution.validator';

describe('ArtifactExecutionValidator', () => {
  const validator = new ArtifactExecutionValidator();
  it('derives response metadata only from the immutable snapshot', () => {
    expect(
      validator.field(
        [
          {
            id: 's',
            fields: [
              {
                id: 'f',
                type: 'DECIMAL',
                unit: '°C',
                validations: [{ min: 0 }],
              },
            ],
          },
        ],
        's',
        'f',
      ),
    ).toEqual({ type: 'DECIMAL', unit: '°C', validations: [{ min: 0 }] });
  });
  it('rejects fields absent from the snapshot', () => {
    expect(() => validator.field([], 's', 'f')).toThrow(ValidationException);
  });
  it('rejects an inverted schedule', () => {
    expect(() =>
      validator.schedule('2026-08-02T00:00:00Z', '2026-08-01T00:00:00Z'),
    ).toThrow(ValidationException);
  });
});
