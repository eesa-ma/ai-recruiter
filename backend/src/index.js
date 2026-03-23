require('dotenv').config() //Loads variables from a .env file into: process.env
const express = require('express')
const  cors = require('cors') //allows frontend to talk to backend
const helmet = require('helmet') //adds security headers

const app = express() //server instance
const port = process.env.PORT || 5000 //Port setup

// middleware
app.use(helmet()) //Protects your app by adding HTTP security headers 
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', //allowed frontend URL
    credentials: true //allow cookies / auth headers
}))
app.use(express.json()) //Converts incoming JSON → JS object

// initialize database
require('./db/database')

// health check route
app.get('/api/health', (req, res) => {
    res.json({status: 'ok'})
})

// start server
app.listen(port, () => {
    console.log(`server running on http://localhost:${port}`)
})