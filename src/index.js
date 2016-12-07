import stylelint from 'stylelint'

const ruleName = 'scale-unlimited/declaration-strict-value'
const utils = stylelint.utils
const messages = utils.ruleMessages(ruleName, {
  expected: (type, value, property) => {
    if (Array.isArray(type)) {
      const typeLast = type.pop()

      type = type.length ? `${type.join(', ')} or ${typeLast}` : typeLast
    }

    return `Expected ${type} for "${value}" of "${property}"`
  },
})
const reVar = /^(?:@.+|\$.+|var\(--.+\))$/
const reFunc = /^.+\(.+\)$/
const defaults = {
  ignoreVariables: true,
  ignoreFunctions: true,
  ignoreKeywords: null,
}

const getIgnoredKeywords = (ignoreKeywords, property) => {
  if (!ignoreKeywords) return null

  const keywords = ignoreKeywords[property] || ignoreKeywords[''] || ignoreKeywords

  return Array.isArray(keywords) ? keywords : [keywords]
}

const rule = (properties, options) =>
  (root, result) => {
    const hasValidOptions = utils.validateOptions(
      result,
      ruleName,
      {
        actual: properties,
        possible: validProperties,
      },
      {
        actual: options,
        possible: validOptions,
        optional: true,
      }
    )

    if (!hasValidOptions) return

    if (!Array.isArray(properties)) {
      properties = [properties]
    }

    const { ignoreVariables, ignoreFunctions, ignoreKeywords } = {
      ...defaults,
      ...options,
    }
    const reKeywords = ignoreKeywords ? {} : null

    properties.forEach((property) => {
      let propFilter = property

      if (propFilter.charAt(0) === '/' && propFilter.slice(-1) === '/') {
        propFilter = new RegExp(propFilter.slice(1, -1))
      }

      root.walkDecls(propFilter, declsWalker)

      function declsWalker(node) {
        const { value, prop } = node
        let validVar = false
        let validFunc = false
        let validKeyword = false

        if (ignoreVariables) {
          validVar = reVar.test(value)
        }

        if (ignoreFunctions && !validVar) {
          validFunc = reFunc.test(value)
        }

        if (ignoreKeywords && (!validVar || !validFunc)) {
          let reKeyword = reKeywords[property]

          if (!reKeyword) {
            const ignoreKeyword = getIgnoredKeywords(ignoreKeywords, property)

            if (ignoreKeyword) {
              reKeyword = new RegExp(`^${ignoreKeyword.join('|')}$`)
              reKeywords[property] = reKeyword
            }
          }

          if (reKeyword) {
            validKeyword = reKeyword.test(value)
          }
        }

        if (!validVar && !validFunc && !validKeyword) {
          const types = []

          if (ignoreVariables) {
            types.push('variable')
          }

          if (ignoreFunctions) {
            types.push('function')
          }

          if (ignoreKeywords && getIgnoredKeywords(ignoreKeywords, property)) {
            types.push('keyword')
          }

          const { raws } = node
          const { start } = node.source

          utils.report({
            ruleName,
            result,
            node,
            line: start.line,
            column: start.column + prop.length + raws.between.length,
            message: messages.expected(types, value, prop),
          })
        }
      }
    })
  }

rule.primaryOptionArray = true

const declarationStrictValuePlugin = stylelint.createPlugin(ruleName, rule)

export default declarationStrictValuePlugin
export { ruleName, messages }

function validProperties(actual) {
  return typeof actual === 'string' ||
    (Array.isArray(actual) && actual.every(item => typeof item === 'string'))
}

function validOptions(actual) {
  if (typeof actual !== 'object') return false

  const allowedKeys = Object.keys(defaults)
  if (!Object.keys(actual).every(key => allowedKeys.indexOf(key) > -1)) return false

  if ('ignoreFunctions' in actual &&
    typeof actual.ignoreFunctions !== 'boolean' &&
    actual.ignoreFunctions !== null) return false

  if ('ignoreKeywords' in actual &&
    !validProperties(actual.ignoreKeywords) &&
    !validHash(actual.ignoreKeywords)) return false

  return true
}

function validHash(actual) {
  if (typeof actual !== 'object') return false

  return Object.keys(actual).every(key => validProperties(actual[key]))
}
