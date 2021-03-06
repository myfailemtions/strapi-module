import Vue from 'vue'
import Hookable from 'hookable'
import { isArray, isObject } from 'lodash'

const TOKEN_KEY = 'strapi_jwt'

class Strapi extends Hookable {
  constructor (ctx) {
    super()

    ctx.$config = ctx.$config || {} // fallback for Nuxt < 2.13
    const runtimeConfig = ctx.$config.strapi || {}
    this.state = Vue.observable({ user: null })

    this.$cookies = ctx.app.$cookies
    this.$http = ctx.$http.create({})
    this.$http.setBaseURL(runtimeConfig.url || '<%= options.url %>')
    this.$http.onError((err) => {
      const { response: { data: { message: msg } } } = err

      let message
      if (isArray(msg)) {
        message = msg[0].messages[0].message
      } else if (isObject(msg)) {
        message = msg.message
      } else {
        message = msg
      }

      err.message = message
      this.callHook('error', err)
    })
  }

  get user () {
    return this.state.user
  }

  set user (user) {
    Vue.set(this.state, 'user', user)
  }

  async register (data) {
    this.clearToken()
    const { user, jwt } = await this.$http.$post('/auth/local/register', data)
    this.setToken(jwt)
    this.setUser(user)
    return { user, jwt }
  }

  async login (data) {
    this.clearToken()
    const { user, jwt } = await this.$http.$post('/auth/local', data)
    this.setToken(jwt)
    this.setUser(user)
    return { user, jwt }
  }
  
  setTokenBeforePush() {
    const jwt = this.getToken()
    this.$http.setToken(jwt, 'Bearer')
  }

  forgotPassword (data) {
    this.clearToken()
    return this.$http.$post('/auth/forgot-password', data)
  }

  async resetPassword (data) {
    this.clearToken()
    const { user, jwt } = await this.$http.$post('/auth/reset-password', data)
    this.setToken(jwt)
    this.setUser(user)
    return { user, jwt }
  }

  sendEmailConfirmation (data) {
    return this.$http.$post('/auth/send-email-confirmation', data)
  }

  logout () {
    this.setUser(null)
    this.clearToken()
  }

  async fetchUser () {
    const jwt = this.getToken()
    if (!jwt) {
      return null
    }

    this.$http.setToken(jwt, 'Bearer')

    try {
      const user = await this.findOne('users', 'me')
      this.setUser(user)
    } catch (e) {
      this.clearToken()
    }

    return this.user
  }

  setUser (user) {
    this.user = user
  }

  find (entity, searchParams) {
    this.setTokenBeforePush()
    return this.$http.$get(`/${entity}`, { searchParams })
  }

  count (entity, searchParams) {
    this.setTokenBeforePush()
    return this.$http.$get(`/${entity}/count`, { searchParams })
  }

  findOne (entity, id) {
    this.setTokenBeforePush()
    return this.$http.$get(`/${entity}/${id}`)
  }

  create (entity, data) {
    this.setTokenBeforePush()
    return this.$http.$post(`/${entity}`, data)
  }

  update (entity, id, data) {
    this.setTokenBeforePush()
    return this.$http.$put(`/${entity}/${id}`, data)
  }

  delete (entity, id) {
    this.setTokenBeforePush()
    return this.$http.$delete(`/${entity}/${id}`)
  }

  getToken () {
    return this.$cookies.get(TOKEN_KEY)
  }

  setToken (jwt) {
    this.$http.setToken(jwt, 'Bearer')
    this.$cookies.set(TOKEN_KEY, jwt)
  }

  clearToken () {
    this.$http.setToken(false)
    this.$cookies.remove(TOKEN_KEY)
  }
}

export default async function (ctx, inject) {
  <%= JSON.stringify(options.entities) %>.forEach((entity) => {
    if (!Strapi.prototype[`$${entity}`]) {
      Object.defineProperty(Strapi.prototype, `$${entity}`, {
        get () {
          const that = this
          return {
            find (...args) {
              return that.find(entity, ...args)
            },
            findOne (...args) {
              return that.findOne(entity, ...args)
            },
            count (...args) {
              return that.count(entity, ...args)
            },
            create (...args) {
              return that.create(entity, ...args)
            },
            update (...args) {
              return that.update(entity, ...args)
            },
            delete (...args) {
              return that.delete(entity, ...args)
            }
          }
        }
      })
    }
  })

  const strapi = new Strapi(ctx)

  if (process.server) {
    // Check if jwt to get user
    await strapi.fetchUser()

    ctx.beforeNuxtRender(({ nuxtState }) => {
      nuxtState.strapi = strapi.state
    })
  }

  const { nuxtState = {} } = ctx || {}
  // Client-side hydration
  if (process.client && nuxtState.strapi) {
    strapi.state = nuxtState.strapi
  }

  // SPA mode or fallback
  if (process.client && !nuxtState.strapi) {
    await strapi.fetchUser()
  }

  inject('strapi', strapi)
  ctx.$strapi = strapi
}
