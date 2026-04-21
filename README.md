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
5. Feed the dataset into a GPT as high-quality context  

---

## 💡 Key insight

> More AI does not automatically mean more value.

---

## ⚙️ Technical setup

### Prerequisites

- Node.js >= 18  
- npm  
- LinkedIn account (authenticated session required)  

---

### 📦 Installation

```bash
git clone https://github.com/Alessandro1981/linkedin-personal-branding-mcp.git
cd linkedin-personal-branding-mcp
npm install
```

---

### ▶️ Run the extractor

```bash
npm run extract
```

or:

```bash
npx ts-node src/extract-cli.ts
```

---

## 👤 Author

Alessandro Bacioccola  
VP Software Engineering | AI & Digital Platforms | Leadership & Innovation
