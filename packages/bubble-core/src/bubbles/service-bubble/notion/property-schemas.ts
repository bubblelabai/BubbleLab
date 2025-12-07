import { z } from 'zod';

// Color enum used across multiple property types
const ColorEnum = z.enum([
  'default',
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
]);

// Checkbox property schema
const CheckboxPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('checkbox').describe('Property type'),
  checkbox: z.object({}).describe('Checkbox configuration (empty object)'),
});

// Created by property schema
const CreatedByPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('created_by').describe('Property type'),
  created_by: z.object({}).describe('Created by configuration (empty object)'),
});

// Created time property schema
const CreatedTimePropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('created_time').describe('Property type'),
  created_time: z
    .object({})
    .describe('Created time configuration (empty object)'),
});

// Date property schema
const DatePropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('date').describe('Property type'),
  date: z.object({}).describe('Date configuration (empty object)'),
});

// Email property schema
const EmailPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('email').describe('Property type'),
  email: z.object({}).describe('Email configuration (empty object)'),
});

// Files property schema
const FilesPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('files').describe('Property type'),
  files: z.object({}).describe('Files configuration (empty object)'),
});

// Formula property schema
const FormulaPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('formula').describe('Property type'),
  formula: z
    .object({
      expression: z.string().describe('The formula expression'),
    })
    .describe('Formula configuration'),
});

// Last edited by property schema
const LastEditedByPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('last_edited_by').describe('Property type'),
  last_edited_by: z
    .object({})
    .describe('Last edited by configuration (empty object)'),
});

// Last edited time property schema
const LastEditedTimePropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('last_edited_time').describe('Property type'),
  last_edited_time: z
    .object({})
    .describe('Last edited time configuration (empty object)'),
});

// Multi-select option schema
const MultiSelectOptionSchema = z.object({
  id: z.string().describe('Option ID'),
  name: z.string().describe('Option name'),
  color: ColorEnum.describe('Option color'),
});

// Multi-select property schema
const MultiSelectPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('multi_select').describe('Property type'),
  multi_select: z
    .object({
      options: z.array(MultiSelectOptionSchema).describe('Available options'),
    })
    .describe('Multi-select configuration'),
});

// Number format enum
const NumberFormatEnum = z.enum([
  'number',
  'number_with_commas',
  'percent',
  'dollar',
  'canadian_dollar',
  'singapore_dollar',
  'euro',
  'pound',
  'yen',
  'ruble',
  'rupee',
  'won',
  'yuan',
  'real',
  'lira',
  'rupiah',
  'franc',
  'hong_kong_dollar',
  'new_zealand_dollar',
  'krona',
  'norwegian_krone',
  'mexican_peso',
  'rand',
  'new_taiwan_dollar',
  'danish_krone',
  'zloty',
  'baht',
  'forint',
  'koruna',
  'shekel',
  'chilean_peso',
  'philippine_peso',
  'dirham',
  'colombian_peso',
  'riyal',
  'ringgit',
  'leu',
  'argentine_peso',
  'uruguayan_peso',
  'peruvian_sol',
]);

// Number property schema
const NumberPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('number').describe('Property type'),
  number: z
    .object({
      format: NumberFormatEnum.describe('Number format'),
    })
    .describe('Number configuration'),
});

// People property schema
const PeoplePropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('people').describe('Property type'),
  people: z.object({}).describe('People configuration (empty object)'),
});

// Phone number property schema
const PhoneNumberPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('phone_number').describe('Property type'),
  phone_number: z
    .object({})
    .describe('Phone number configuration (empty object)'),
});

// Place property schema
const PlacePropertySchema = z.object({
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('place').describe('Property type'),
  place: z.object({}).describe('Place configuration (empty object)'),
});

// Relation property schema
const RelationPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('relation').describe('Property type'),
  relation: z
    .object({
      data_source_id: z.string().describe('ID of the related data source'),
      dual_property: z
        .object({
          synced_property_id: z.string().describe('ID of the synced property'),
          synced_property_name: z
            .string()
            .describe('Name of the synced property'),
        })
        .optional()
        .describe('Dual property configuration'),
    })
    .describe('Relation configuration'),
});

// Rich text property schema
const RichTextPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('rich_text').describe('Property type'),
  rich_text: z.object({}).describe('Rich text configuration (empty object)'),
});

// Rollup function enum
const RollupFunctionEnum = z.enum([
  'average',
  'checked',
  'count_per_group',
  'count',
  'count_values',
  'date_range',
  'earliest_date',
  'empty',
  'latest_date',
  'max',
  'median',
  'min',
  'not_empty',
  'percent_checked',
  'percent_empty',
  'percent_not_empty',
  'percent_per_group',
  'percent_unchecked',
  'range',
  'unchecked',
  'unique',
  'show_original',
  'show_unique',
  'sum',
]);

// Rollup property schema
const RollupPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('rollup').describe('Property type'),
  rollup: z
    .object({
      function: RollupFunctionEnum.describe('Rollup function'),
      relation_property_id: z.string().describe('ID of the relation property'),
      relation_property_name: z
        .string()
        .describe('Name of the relation property'),
      rollup_property_id: z.string().describe('ID of the rollup property'),
      rollup_property_name: z.string().describe('Name of the rollup property'),
    })
    .describe('Rollup configuration'),
});

// Select option schema
const SelectOptionSchema = z.object({
  id: z.string().describe('Option ID'),
  name: z.string().describe('Option name'),
  color: ColorEnum.describe('Option color'),
});

// Select property schema
const SelectPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('select').describe('Property type'),
  select: z
    .object({
      options: z.array(SelectOptionSchema).describe('Available options'),
    })
    .describe('Select configuration'),
});

// Title property schema
const TitlePropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('title').describe('Property type'),
  title: z.object({}).describe('Title configuration (empty object)'),
});

// URL property schema
const URLPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('url').describe('Property type'),
  url: z.object({}).describe('URL configuration (empty object)'),
});

// Unique ID property schema
const UniqueIDPropertySchema = z.object({
  id: z.string().describe('Property ID'),
  name: z.string().describe('Property name'),
  description: z.string().optional().describe('Property description'),
  type: z.literal('unique_id').describe('Property type'),
  unique_id: z
    .object({
      prefix: z.string().optional().describe('Optional prefix for unique IDs'),
    })
    .describe('Unique ID configuration'),
});

// Union of all property types
export const DataSourcePropertySchema = z.discriminatedUnion('type', [
  CheckboxPropertySchema,
  CreatedByPropertySchema,
  CreatedTimePropertySchema,
  DatePropertySchema,
  EmailPropertySchema,
  FilesPropertySchema,
  FormulaPropertySchema,
  LastEditedByPropertySchema,
  LastEditedTimePropertySchema,
  MultiSelectPropertySchema,
  NumberPropertySchema,
  PeoplePropertySchema,
  PhoneNumberPropertySchema,
  PlacePropertySchema,
  RelationPropertySchema,
  RichTextPropertySchema,
  RollupPropertySchema,
  SelectPropertySchema,
  TitlePropertySchema,
  URLPropertySchema,
  UniqueIDPropertySchema,
]);

// Export individual schemas for use in other files
export {
  ColorEnum,
  CheckboxPropertySchema,
  CreatedByPropertySchema,
  CreatedTimePropertySchema,
  DatePropertySchema,
  EmailPropertySchema,
  FilesPropertySchema,
  FormulaPropertySchema,
  LastEditedByPropertySchema,
  LastEditedTimePropertySchema,
  MultiSelectPropertySchema,
  MultiSelectOptionSchema,
  NumberPropertySchema,
  NumberFormatEnum,
  PeoplePropertySchema,
  PhoneNumberPropertySchema,
  PlacePropertySchema,
  RelationPropertySchema,
  RichTextPropertySchema,
  RollupPropertySchema,
  RollupFunctionEnum,
  SelectPropertySchema,
  SelectOptionSchema,
  TitlePropertySchema,
  URLPropertySchema,
  UniqueIDPropertySchema,
};
