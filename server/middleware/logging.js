import winston from 'winston'
import { v4 as uuidv4 } from 'uuid'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'life-growth-tracker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

export function requestLogger(req, res, next) {
  const requestId = uuidv4()
  const startTime = Date.now()

  req.requestId = requestId

  // Log request
  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id || null,
    ip: req.ip,
    userAgent: req.get('user-agent')
  })

  // Override res.end to log response
  const originalEnd = res.end
  res.end = function(...args) {
    const duration = Date.now() - startTime
    
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id || null
    })

    originalEnd.apply(this, args)
  }

  next()
}

export default logger


