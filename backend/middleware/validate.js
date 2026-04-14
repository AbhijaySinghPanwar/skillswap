const Joi = require('joi');

/**
 * Validation factory — returns Express middleware that validates req.body against a Joi schema.
 * Sends a 400 with the first validation error if the body is invalid.
 */
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }
  next();
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

const signupSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 50 characters',
    'any.required': 'Name is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': 'Password must be at least 6 characters',
    'any.required': 'Password is required'
  }),
  bio: Joi.string().max(300).optional().allow(''),
  skillsOffered: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  skillsWanted: Joi.array().items(Joi.string().max(50)).max(20).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string().min(1).max(128).required().messages({
    'any.required': 'Password is required'
  })
});

const sendRequestSchema = Joi.object({
  toUser: Joi.string().hex().length(24).required().messages({
    'any.required': 'Target user is required'
  }),
  skillOffered: Joi.string().min(1).max(50).required(),
  skillWanted: Joi.string().min(1).max(50).required(),
  message: Joi.string().max(500).optional().allow('')
});

const sendMessageSchema = Joi.object({
  receiverId: Joi.string().hex().length(24).required(),
  content: Joi.string().min(1).max(1000).required().messages({
    'string.empty': 'Message cannot be empty',
    'string.max': 'Message too long (max 1000 characters)'
  })
});

module.exports = {
  validate,
  signupSchema,
  loginSchema,
  sendRequestSchema,
  sendMessageSchema
};
