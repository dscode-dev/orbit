import { ValidationException } from '../../exceptions';
import { ArtifactTemplateValidator } from './artifact-template.validator';

describe('ArtifactTemplateValidator', () => {
  const validator = new ArtifactTemplateValidator();
  const section = (id: string, order: number, fieldType = 'CUSTOM_SENSOR') => ({
    id,
    title: id,
    order,
    type: 'FORM',
    required: false,
    visibility: 'VISIBLE',
    permissions: [],
    collapsible: false,
    configuration: {},
    fields: [
      {
        id: 'reading',
        label: 'Reading',
        type: fieldType,
        order: 0,
        required: false,
        readOnly: false,
        hidden: false,
        validations: [],
        dependencies: [],
        configuration: {},
      },
    ],
  });

  it('accepts new metadata-driven field types without code changes', () => {
    expect(() =>
      validator.validate([section('measurements', 0)], []),
    ).not.toThrow();
  });

  it('rejects duplicate section order values', () => {
    expect(() =>
      validator.validate([section('one', 0), section('two', 0)], []),
    ).toThrow(ValidationException);
  });

  it('rejects duplicate field ids inside a section', () => {
    const duplicated = section('measurements', 0);
    duplicated.fields.push({ ...duplicated.fields[0]! });
    expect(() => validator.validate([duplicated], [])).toThrow(
      'Duplicate field ids in section measurements',
    );
  });
});
