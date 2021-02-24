import express from 'express'
import cors from 'cors'
import compression from 'compression'
import morgan from 'morgan'
import bodyParser from 'body-parser'
import { errorHandler as queryErrorHandler } from 'querymen'
import { errorHandler as bodyErrorHandler } from 'bodymen'
import { env } from '../../config'

export default (apiRoot, routes) => {
  const app = express()

  /* istanbul ignore next */
  app.use((req, res, next) => {
    //logger.debug('PATH: ' + req.originalUrl)
    res.setHeader('X-Powered-By', 'Aviot Avionic IOT')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', req.get('origin') || '*')
    res.setHeader('Access-Control-Allow-Methods', 'HEAD, OPTIONS, GET, POST, PUT, DELETE')
    res.setHeader('Allow', 'HEAD, OPTIONS, GET, POST, PUT, DELETE')
    res.setHeader('Access-Control-Max-Age', 86400)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, access_token')
    next()
  })


  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json())
  app.use(apiRoot, routes)
  app.use(queryErrorHandler())
  app.use(bodyErrorHandler())

  return app
}
