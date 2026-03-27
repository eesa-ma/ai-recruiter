const express = require('express')
const { v4: uuidv4 } = require('uuid')
const db = require('../db/database')
const { authenticate, requireRole } = require('../middleware/auth')
//const { route } = require('./auth')

const router = express.Router()

// Helper - build full profile object
const getFullProfile = (userId) => {
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId)
    if (!profile) return null

    const experience = db.prepare('SELECT * FROM experience WHERE profile_id = ?').all(profile.id)
    const skills = db.prepare('SELECT * FROM skills WHERE profile_id = ?').all(profile.id)
    const projects = db.prepare('SELECT * FROM projects WHERE profile_id = ?').all(profile.id)
    const education = db.prepare('SELECT * FROM education WHERE profile_id = ?').all(profile.id)
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)

    return {
        ...profile,
        user,
        experience: experience.map(e => ({ ...e, skills: JSON.parse(e.skills || '[]') })),
        skills,
        projects: projects.map(p => ({ ...p, tech_stack: JSON.parse(p.tech_stack || '[]') })),
        education
    }

}

// Helper - calculate completion
const calcCompletion = (profileId) => {
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId)
    const expCount = db.prepare('SELECT COUNT(*) as c FROM experience WHERE profile_id = ?').get(profileId).c
    const skillCount = db.prepare('SELECT COUNT(*) as c FROM skills WHERE profile_id = ?').get(profileId).c
    const projCount = db.prepare('SELECT COUNT(*) as c FROM projects WHERE profile_id = ?').get(profileId).c
    const eduCount = db.prepare('SELECT COUNT(*) as c FROM education WHERE profile_id = ?').get(profileId).c

    let pct = 0
    if (profile?.headline) pct += 15
    if (profile?.summary) pct += 20
    if (expCount > 0) pct += 25
    if (skillCount >= 3) pct += 20
    if (projCount > 0) pct += 10
    if (eduCount > 0) pct += 10

    return Math.min(pct, 100)
}

// get full profile
router.get('/me', authenticate, requireRole('candidate'), (req, res) => {
    const profile = getFullProfile(req.user.id)
    if (!profile) return res.status(404).json({ error: 'Profile not found' })
    res.json({ profile })
})

// update basic info 
router.patch('/me', authenticate, requireRole('candidate'), (req, res) => {
    const { headline, summary, location } = req.body

    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)
    if (!profile) return res.status(404).json({ error: 'Profile not found' })

    db.prepare(`
        UPDATE profiles SET
            headline = COALESCE(?, headline),
            summary = COALESCE(?, summary),
            location = COALESCE(?, location)
        WHERE id = ?
    `).run(headline, summary, location, profile.id)

    const pct = calcCompletion(profile.id)
    db.prepare('UPDATE profiles SET completion_pct = ? WHERE id = ?').run(pct, profile.id)

    res.json({ profile: getFullProfile(req.user.id) })
})

// add experience
router.post('/experience', authenticate, requireRole('candidate'), (req, res) => {
    const { role, company, duration, description, skills } = req.body

    if (!role || !company)
        return res.status(400).json({ error: 'role and company are required' })

    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)
    const id = uuidv4()

    db.prepare(`
        INSERT INTO experience (id, profile_id, role, company, duration, description, skills)
        VALUES(?, ?, ?, ?, ?, ?, ?)
    `).run(id, profile.id, role, company, duration, description, JSON.stringify(skills || []))

    const pct = calcCompletion(profile.id)
    db.prepare('UPDATE profiles SET completion_pct = ? WHERE id = ? ').run(pct, profile.id)

    res.status(201).json({ id, message: 'Experience added' })
})

// delete experience 
router.delete('/experience/:id', authenticate, requireRole('candidate'), (req, res) => {
    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)

    db.prepare('DELETE FROM experience WHERE id = ? AND profile_id = ?').run(req.params.id, profile.id)   //req.params contains values from the URL path

    res.json({ message: 'Deleted' })
})


//add skills
router.post('/skills', authenticate, requireRole('candidate'), (req, res) => {
    const { skills } = req.body

    if (!Array.isArray(skills))
        return res.status(400).json({
            error: 'Skills must be an array'
        })

    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)


    // get existing skills from database
    const existingSkills = db.prepare('SELECT name FROM skills WHERE profile_id = ?').all(profile.id)

    // get just the names as an array
    const existingNames = existingSkills.map(s => s.name.toLowerCase())

    // only insert skills that don't already exist
    const insert = db.prepare(`
    INSERT INTO skills (id, profile_id, name, level, category)
    VALUES (?, ?, ?, ?, ?)
    `)

    skills.forEach(skill => {
        // check if skill already exists
        if (!existingNames.includes(skill.name.toLowerCase())) {
            insert.run(uuidv4(), profile.id, skill.name, skill.level || 'intermediate', skill.category || 'General')
        }
    })

    const pct = calcCompletion(profile.id)
    db.prepare('UPDATE profiles SET completion_pct = ? WHERE id = ?').run(pct, profile.id)

    res.status(201).json({ message: 'Skills added ' })
})

// Delete skill
router.delete('/skills/:id', authenticate, requireRole('candidate'), (req, res) => {
    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)

    db.prepare('DELETE FROM skills WHERE id = ? AND profile_id = ?').run(req.params.id, profile.id)

    res.json({ message: 'Deleted' })
})

// add project
router.post('/projects', authenticate, requireRole('candidate'), (req, res) => {
    const { title, description, tech_stack, link } = req.body

    if (!title)
        return res.status(400).json({ error: 'Title is required' })

    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)

    const id = uuidv4()

    db.prepare(`
        INSERT INTO projects (id, profile_id, title, description, tech_stack, link) 
        VALUES (?, ?, ?, ?, ?, ?)  
    `).run(id, profile.id, title, description, JSON.stringify(tech_stack || []), link)

    const pct = calcCompletion(profile.id)
    db.prepare('UPDATE profiles SET completion_pct = ? WHERE id = ?').run(pct, profile.id)

    res.status(201).json({ id, message: 'Project added ' })
})

// delete project
router.delete('/projects/:id', authenticate, requireRole('candidate'), (req, res) => {
    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)

    db.prepare('DELETE FROM projects WHERE id = ? AND profile_id = ?').run(req.params.id, profile.id)

    res.json({ message: 'Deleted' })
})

// add education
router.post('/education', authenticate, requireRole('candidate'), (req, res) => {
    const { institution, degree, field, start_year, end_year, grade } = req.body

    if (!institution)
        return res.status(400).json({ error: 'Institution is required ' })

    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)

    const id = uuidv4()

    db.prepare(`
        INSERT INTO education ( id, profile_id, institution, degree, field, start_year, end_year, grade ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)    
    `).run(id, profile.id, institution, degree, field, start_year, end_year, grade)

    const pct = calcCompletion(profile.id)
    db.prepare('UPDATE profiles SET completion_pct = ? WHERE id = ?').run(pct, profile.id)

    res.status(201).json({ id, message: 'Education added' })
})

// delete education
router.delete('/education/:id', authenticate, requireRole('candidate'), (req, res) => {
    const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.user.id)

    db.prepare('DELETE FROM education WHERE id = ? AND profile_id = ?').run(req.params.id, profile.id)

    res.json({ message: "Deleted " })
})

// public profile via share token
router.get('/public/:token', (req, res) => {
  const profile = db.prepare(
    'SELECT user_id FROM profiles WHERE share_token = ?'
  ).get(req.params.token)

  if (!profile) return res.status(404).json({ error: 'Profile not found' })
  res.json({ profile: getFullProfile(profile.user_id) })
})


module.exports = router