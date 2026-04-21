# LinkedIn Personal Branding MCP

## From data to positioning

This project is not just a LinkedIn extractor.

It is a pragmatic experiment to answer a simple question:

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

At the same time, most GenAI initiatives struggle to scale.

Not because of the model.  
But because they lack:

- context
- integration
- real use cases

This project sits exactly at that intersection.

---

## 🧠 What it does

The MCP (Model Context Pipeline) extracts and structures:

- Profile core (headline, location, about)
- Career progression (roles, timeline, company)
- Education
- Skills
- (optionally) recent content

Turning this:

> A visual, human-oriented profile

Into this:

> A structured dataset that can be analyzed, compared, and evolved over time

---

## 🏗️ Architecture (high level)

```mermaid
flowchart LR
    A[LinkedIn Profile<br/>(unstructured data)] --> B[Extractor Layer<br/>(Playwright)]
    B --> C[MCP Layer<br/>(cleaning, structuring, parsing)]
    C --> D[Structured Dataset]
    D --> E[GPT / LLM]
    E --> F[Output<br/>(posts, insights, positioning)]
```

---

## ⚙️ How it works

1. Extract raw data from LinkedIn
2. Normalize and reconstruct content (LinkedIn DOM is not structured)
3. Apply heuristic parsing (roles, timeline, skills, etc.)
4. Build a structured dataset
5. Feed the dataset into a GPT as **high-quality context**

👉 The result is not more AI  
👉 The result is **better AI usage**

---

## 🚀 Quick start

### 1. Install

```bash
git clone https://github.com/Alessandro1981/linkedin-personal-branding-mcp.git
cd linkedin-personal-branding-mcp
npm install
```

### 2. Login (required for LinkedIn access)

```bash
npm run login
```

This will create a local authenticated session.

### 3. Extract your profile

```bash
npm run extract
```

This will generate structured data in:

```text
/exports
```

### 4. Compare snapshots (optional)

```bash
npm run compare
```

Useful to track how your positioning evolves over time.

---

## 📂 Project structure

```text
.
├── src/
│   ├── extractor.ts          # extraction logic
│   ├── extract-cli.ts        # CLI entry point
│   ├── login.ts              # session handling
│   ├── compare-exports.ts    # profile comparison
│   └── ...
├── exports/                  # structured output data
├── examples/                 # sample data / experiments
├── package.json
└── README.md
```

---

## 📊 Example output (simplified)

```json
{
  "headline": "VP Software Engineering | AI & Digital Platforms",
  "experience": [
    {
      "role": "VP Software Engineering",
      "company": "Invenco by GVR",
      "duration": "2026 - Present"
    }
  ],
  "skills": ["Leadership", "AI", "Software Engineering"]
}
```

---

## 🧩 Using it with GPT (MCP flow)

Once you have structured data:

1. Feed it into your GPT / LLM
2. Use prompts like:
   - “Improve my LinkedIn headline”
   - “Generate a post consistent with my positioning”
   - “Avoid repeating previous content”
   - “Align my communication with a VP role”

---

## 💡 Key insight

> More AI does not automatically mean more value.

In many real-world scenarios:

- context quality > model capability
- structured input > raw data
- clarity > automation

A partially manual MCP can outperform a fully automated pipeline  
when the goal is **reliability and real usability**.

---

## 🧭 When to use this approach

This pattern works best when:

- you are validating a use case
- context quality is critical
- full automation is not yet justified
- you want fast iteration before scaling

---

## ⚖️ What this is (and what it is not)

### ✅ This is:

- a pragmatic experiment
- a positioning tool
- a real-world AI adoption pattern

### ❌ This is NOT:

- a production-ready AI platform
- a fully automated pipeline
- a scalable architecture (yet)

---

## 🔮 Future directions

- partial automation of ingestion
- API integration
- multi-use-case expansion

Only after **real value is proven**.

---

## 🧠 Final thought

The question is not:

> "How advanced is the technology?"

But:

> "How useful is it in the context where it is applied?"

---

## 👤 Author

Alessandro Bacioccola  
VP Software Engineering | AI & Digital Platforms | Leadership & Innovation
