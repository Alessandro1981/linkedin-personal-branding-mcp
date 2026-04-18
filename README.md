# LinkedIn Personal Branding MCP

## From data to positioning

This project is not just a LinkedIn extractor.

It is an experiment to answer a simple question:

> Can we turn a professional profile into structured data,  
> and use that data to drive better positioning, storytelling and leadership communication?

---

## 🎯 Why this project exists

As leaders grow in their careers, their role changes:

- from execution → to direction  
- from delivery → to impact  
- from expertise → to influence  

Yet, most LinkedIn profiles remain:
- static  
- unstructured  
- underutilized  

This project aims to bridge that gap.

---

## 🧠 What it does

The MCP (Model Context Pipeline) extracts and structures:

- Profile core (headline, location, about)
- Career progression (roles, timeline, company)
- Education
- Skills

Turning this:

> A visual, human-oriented profile

Into this:

> A structured dataset that can be analyzed, compared, and evolved over time

---

## 🚀 What you can build on top of it

Once your profile is structured, you can:

### 1. Analyze your positioning
- Career progression clarity
- Role evolution (Engineer → Manager → Director → VP)
- Gaps between actual experience and perceived positioning

### 2. Improve your LinkedIn presence
- Generate stronger headlines
- Rewrite About sections with strategic focus
- Align communication with your target role

### 3. Drive your content strategy
- Identify your core themes
- Maintain consistency across posts
- Avoid random or incoherent messaging

### 4. Track evolution over time
- Compare snapshots of your profile
- Understand how your positioning evolves
- Align profile with career moves

---

## 💡 Why this matters 

At senior leadership level, your profile is not a CV.

It is:
- a positioning tool  
- a narrative asset  
- a signal to your ecosystem  

This project treats it as such.

---

## 🏗️ Architecture (high level)

- Playwright-based extraction
- DOM normalization via `innerText`
- Text reconstruction (LinkedIn is not structured HTML)
- Heuristic parsing for:
  - Experience blocks
  - Roles and timelines
  - Skills and education

---

## ⚙️ Technical setup

### Prerequisites
- Node.js >= 18
- npm
- LinkedIn account (authenticated session required)

---

### Installation

```bash
git clone https://github.com/Alessandro1981/linkedin-personal-branding-mcp.git
cd linkedin-personal-branding-mcp
npm install
