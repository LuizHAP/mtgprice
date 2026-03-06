import winston from 'winston'

/**
 * Winston logger configuration
 *
 * Log levels:
 * - error: Error events that might still allow the application to continue running
 * - warn: Warning events that might cause issues
 * - info: Informational messages that highlight the progress of the application
 * - debug: Detailed information for debugging purposes
 */

const logLevel = process.env.LOG_LEVEL || 'info'

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: 'mtg-price-monitor' },
  transports: [
    // Write all logs with importance level of `error` or less to error.log
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs to combined.log
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
})

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`
          }
          return msg
        }),
      ),
    }),
  )
}

export { logger }
