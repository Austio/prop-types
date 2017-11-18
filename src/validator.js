import { flatten, includes, isFunction, isObjectLike, each, every, some } from 'lodash'

export function runValidation(validator, value, strict = false) {
  const types = ensureArray(validator.type)

  return (
    types.length === 0 ||
    types.some(type => isType(type, value, strict || validator.required !== true))
  ) && (
    typeof validator.validator !== 'function' ||
    validator.validator(value)
  )
}

export default class PropType {
  /** @private */
  constructor(type) {
    this.type = ensureArray(type)
  }

  get isRequired() {
    this.required = true

    return this
  }

  value(value) {
    this.default = isObjectLike(value) ? () => value : value

    return this
  }

  validate(cb) {
    if (!isFunction(cb)) return this

    const validator = this.validator

    this.validator = (...args) => {
      try {
        return (
          !isFunction(validator) || validator.call(this, args)
        ) && cb.apply(this, args)
      } catch (err) {
        return false
      }
    }

    return this
  }

  modifiers(name, ...modifiers) {
    const props = {
      [name]: this
    }

    flatten(modifiers).forEach(modifier => {
      props[`${name}.${modifier}`] = PropType.clone(this)
    })

    return props
  }

  /** @private */
  static create(type) {
    return new PropType(type)
  }

  /** @private */
  static clone(prop) {
    const type = this.create(prop.type)

    type.validate(prop.validator)

    return type
  }

  static get string() {
    return this.create(String)
  }

  static get number() {
    return this.create(Number)
  }

  static get bool() {
    return this.create(Boolean)
  }

  static get array() {
    return this.create(Array)
  }

  static get object() {
    return this.create(Object)
  }

  static get func() {
    return this.create(Function)
  }

  static get symbol() {
    return this.create(Symbol)
  }

  static get any() {
    return this.create()
  }

  static instanceOf(type) {
    return this.create(type)
  }

  static oneOf(...values) {
    values = flatten(values)

    ensureOne(values)

    const prop = this.create()

    values = new Set(values)

    prop.validator = value => {
      return values.has(value)
    }

    return prop
  }

  static oneOfType(...types) {
    types = flatten(types).map(normalizeType)

    ensureOne(types)

    const prop = this.create(flatten(types.map(type => type.type)))
    const validators = types.filter(type => type.validator)

    if (validators.length > 0) {
      prop.validator = value => validators.some(
        validator => runValidation(validator, value)
      )
    }

    return prop
  }

  static arrayOf(...expected) {
    return this.collectionOf(Array, expected)
  }

  static objectOf(...expected) {
    return this.collectionOf(Object, expected)
  }

  /** @private */
  static collectionOf(type, expected) {
    const prop = this.create(type)
    const types = flatten(expected).map(normalizeType)

    prop.validator = value => Object.values(value).every(
      item => types.some(type => runValidation(type, item))
    )

    return prop
  }

  static shape(shape) {
    const prop = this.create(Object)
    const shapeType = {}

    each(shape, (value, key) => {
      shapeType[key] = normalizeType(value)
    })

    prop.validator = value => {
      if (!isObjectLike(value)) return prop.required !== true

      return every(shapeType, (type, key) => runValidation(type, value[key]))
    }

    return prop
  }
}

const TYPES = {
  string: String,
  number: Number,
  object: Object,
  boolean: Boolean,
  function: Function,
  symbol: Symbol,
  array: Array
}

function isType(type, item, nullAllowed = false) {
  if (nullAllowed && (item === null || item === undefined)) return true

  if (Array === type && Array.isArray(item)) return true

  return some(TYPES,
    (TYPE, key) => (TYPE === type && typeof item === key) // eslint-disable-line valid-typeof
  )
}

function ensureOne(items) {
  if (items.length === 0) throw new Error('Atleast one type or value is required')
}

function ensureArray(value) {
  return Array.isArray(value) ? value : (
    value === undefined ? [] : [value]
  )
}

function normalizeType(type) {
  if (type in TYPES) return PropType.create(TYPES[type])

  if (includes(TYPES, type)) return PropType.create(type)

  if (isFunction(type)) return { validator: type, type: [] }

  return type
}
