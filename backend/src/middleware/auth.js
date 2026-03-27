const jwt  = require('jsonwebtoken')

const authenticate = (req, res, next) => {
    //get token from the request header
    const authHeader = req.headers.authorization

    // if no token block the request 
    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({error: 'No token provided'})
    }

    try {
        //extract just the token part (remove "Bearer")
        const token = authHeader.split(' ')[1]

        //verify it and decode user info
        req.user = jwt.verify(token, process.env.JWT_SECRET)

        //move to next function 
        next()

    } catch {
        return res.status(401).json({error: 'Invalid or expired token'})
    }
}

const requireRole = (...roles) => (req, res, next) => {  //...roles means it accepts multiple roles
    if(!roles.includes(req.user?.role)) {
        return res.status(403).json({error: 'Access denied'})
    }
    next() // Express routes work like a chain
}

module.exports = {authenticate,  requireRole}