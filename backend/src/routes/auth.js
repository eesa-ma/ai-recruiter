const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const db = require('../db/database')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// REGISTER 
router.post('/register', (req, res) => {
    const { name, email, password, role } = req.body

    // 1. check all fields exists
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All the fields are required' })
    }

    // 2. checck the role is valid
    if (!['candidate', 'recruiter'].includes(role)) {
        return res.status(400).json({ error: 'Role must be candidate or recruiter' })
    }

    // 3. check  email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' })
    }

    // 4. hash the password
    const hashedPassword = bcrypt.hashSync(password, 10)

    // 5. save to database
    const id = uuidv4()
    db.prepare(`
        INSERT INTO users (id, email, password, role, name)
        VALUES (?, ?, ?, ?, ?)
    `).run(id, email.toLowerCase(), hashedPassword, role, name)

    // 6. if candidate, create empty profile
    if (role === 'candidate') {
        db.prepare(`
            INSERT INTO profiles (id, user_id, completion_pct, share_token)
            VALUES (?, ?, 0, ?)
        `).run(uuidv4(), id, uuidv4())
    }

    // 7. creates a token
    const token = jwt.sign(
        { id, email, role, name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    )

    // 8 . send token back
    res.status(201).json({
        token,
        user: { id, name, email, role }
    })
})

// LOGIN
router.post('/login', (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password is required" })
    }

    // 1. find user in database
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())

    // 2.  check user exists and password matches
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Ivalid credentials ' })
    }

    // 3. create a token
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    )

    // 4. send the token
    res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
    })
})


// get my info
router.get('/me', authenticate, (req, res) => {
    const user = db.prepare(
        'SELECT id, name, email, role FROM users WHERE id = ?'
    ).get(req.user.id)

    if (!user) return res.status(404).json({ error: 'User not found ' })
    res.json({ user })
})

module.exports = router