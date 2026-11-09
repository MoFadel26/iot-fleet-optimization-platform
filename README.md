# IoT Fleet Optimization Platform

## What This Does

This is a website that helps you plan the best driving routes for a fleet of vehicles, using live data from internet-connected sensors.

## What You Need to Install First

You will install three free programs. Just download each one and run the installer — click "Next" through every screen and accept the defaults.

1. **Node.js** (lets your computer run the website code)
   Download here: <https://nodejs.org/en/download> — pick the big green "LTS" button.

2. **Python** (lets your computer run the calculation engine in the background)
   Download here: <https://www.python.org/downloads/> — pick the yellow "Download Python" button.
   **Important for Windows users:** on the very first installer screen, tick the box that says **"Add Python to PATH"** before clicking Install.

3. **A free MongoDB Atlas account** (an online database that stores the fleet info) — optional
   Sign up here: <https://www.mongodb.com/cloud/atlas/register>. After signing up, create a free "M0" cluster and copy the connection string it gives you — you'll paste it in later.
   Without it, the calculation engine still runs: it uses built-in demo data (the same data `seed_db.py` loads into Atlas) and forgets saved runs when it stops.

You also need a free **HERE Maps** key (for looking up addresses on the map). Sign up at <https://platform.here.com/>, create a project, and copy the API Key.

## How to Download This Project

1. Open this page in your browser: the GitHub page for this project.
2. Look for the green **"Code"** button near the top right and click it.
3. In the small menu that opens, click **"Download ZIP"**.
4. A file called something like `Iotfleetoptimizationplatform-main.zip` will save to your **Downloads** folder.
5. Find that file in your Downloads folder, **right-click it**, and choose **"Extract All"** (Windows) or **double-click it** (Mac). This creates a normal folder with the same name.
6. Move that folder somewhere easy to find, like your **Desktop**.

## How to Run It

You will need to open a "terminal" twice. A terminal is just a window where you type commands.

- **On Windows:** click the Start menu, type `PowerShell`, and press Enter.
- **On Mac:** press `Command + Space`, type `Terminal`, and press Enter.

### Step 1 — Go into the project folder

In the terminal, type this and press Enter. This tells the terminal to "look inside" the project folder. If you put it on your Desktop, this command will work as-is:

```
cd Desktop/Iotfleetoptimizationplatform-main
```

### Step 2 — Create the settings file

This project needs a small file called `.env` that holds your database password and map key. Type this and press Enter to make a copy of the example file:

**On Mac:**
```
cp .env.example .env
```

**On Windows:**
```
copy .env.example .env
```

Now open the new `.env` file in any text editor (Notepad on Windows, TextEdit on Mac). You'll see lines like `MONGO_URI=` and `HERE_API_KEY=`. Replace the value after the `=` on the `MONGO_URI` line with your MongoDB connection string, and the value on the `HERE_API_KEY` line with your HERE key. Leave the other lines as they are. Save and close the file.

Every variable is described in `.env.example`.

### Step 3 — Install the website's building blocks

Type this and press Enter. This downloads all the small pieces of code the website is built from. It will take a few minutes and print a lot of text — that's normal.

```
npm install
```

### Step 4 — Install the calculation engine's building blocks

Type this and press Enter. This downloads the pieces the Python background service needs.

```
pip install -r requirements.txt
```

If `pip` is not found, try `pip3` instead.

### Step 5 — Start the calculation engine (background service)

Type this and press Enter. Leave this terminal window open — closing it will stop the service.

```
python optimizer_api.py
```

If `python` is not found, try `python3` instead. You should see a message that ends with `http://localhost:5001`. That means it's working.

The calculation engine uses port 5001, not the more common 5000, because macOS uses port 5000 for AirPlay Receiver.

### Step 6 — Start the website

Open a **second** terminal window (same way as before). Go into the project folder again:

```
cd Desktop/Iotfleetoptimizationplatform-main
```

Then type this and press Enter:

```
npm run dev
```

After a few seconds you'll see a line that says something like `Local: http://localhost:5173/`.

### Step 7 — Open the website

Open your browser and go to **<http://localhost:5173>**

## Running the Tests

The solver has a small test suite (under 15 seconds). In the project folder:

```
pip install -r requirements-dev.txt
python -m pytest
```

It does not need MongoDB.

## If Something Goes Wrong

**If you see: `'npm' is not recognized` or `command not found: npm`** — Do this: Node.js isn't installed yet, or you need to close and reopen the terminal so it notices the new install. Reinstall from <https://nodejs.org/en/download> and open a fresh terminal.

**If you see: `'python' is not recognized` or `command not found: python`** — Do this: try typing `python3` instead of `python`. If that also fails, reinstall Python from <https://www.python.org/downloads/> and on Windows make sure you tick **"Add Python to PATH"** on the first installer screen.

**If you see: `cannot reach MongoDB` or `MONGO_URI is not set ... Using in-memory seed data`** — The calculation engine could not use your database, so it is running on built-in demo data. Everything works, but runs are not saved. To use your database instead, open `.env` again and double-check that your `MONGO_URI` line has no typos and that you replaced the `<user>` and `<password>` parts with your real MongoDB username and password. Also go to MongoDB Atlas → **Network Access** and click **Add IP Address → Allow Access from Anywhere**.

**If you see: `Address already in use` / `Port 5001 is in use by another program`** — Do this: another program is using port 5001. Close it, or pick a free port by adding these two lines to `.env` (both must use the same number) and restart both terminals:
```
PORT=5002
VITE_API_URL=http://localhost:5002
```
Avoid port 5000 on a Mac: macOS uses it for AirPlay Receiver.

**If you see: the page loads but the map or data is blank** — Do this: the website (Step 6) is running but the calculation engine (Step 5) isn't. Check the first terminal window — if it's empty or shows an error, run `python optimizer_api.py` again and watch for error messages.
