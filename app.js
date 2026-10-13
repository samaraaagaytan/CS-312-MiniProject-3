require("dotenv").config();

const express = require("express");
const session = require("express-session");

const bcrypt = require("bcryptjs");
const pool = require("./db");

console.log("THIS IS MY CS-312 APP.JS");
const app = express();


const PORT = 3005;

app.set("view engine", "ejs");


app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use(express.static("public"));

app.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM blogs ORDER BY date_created DESC"
        );

        res.render("index", {
            posts: result.rows,
            user: req.session.user
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading blog posts.");
    }
});

app.get("/signup", (req, res) => {
    res.render("signup");
});

app.post("/signup", async (req, res) => {
    const { name, user_id, password } = req.body;

    try {
        const existingUser = await pool.query(
            "SELECT user_id FROM users WHERE user_id = $1",
            [user_id]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).send(
                'That username is already taken. <a href="/signup">Try again</a>'
            );
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.query(
            "INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)",
            [user_id, hashedPassword, name]
        );

        req.session.user = {
            user_id: user_id,
            name: name
        };

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong during signup.");
    }
});

app.get("/signin", (req, res) => {
    res.render("signin");
});

app.post("/signin", async (req, res) => {
    const { user_id, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE user_id = $1",
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.status(401).send(
                'Incorrect username or password. <a href="/signin">Try again</a>'
            );
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatches) {
            return res.status(401).send(
                'Incorrect username or password. <a href="/signin">Try again</a>'
            );
        }

        req.session.user = {
            user_id: user.user_id,
            name: user.name
        };

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong during signin.");
    }
});

app.get("/posts/:id/edit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const postId = req.params.id;
    const userId = req.session.user.user_id;

    try {
        const result = await pool.query(
            "SELECT * FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
            [postId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Post not found or you cannot edit this post.");
        }

        res.render("edit", { post: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading the post for editing.");
    }
});

app.post("/posts/:id/edit", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const postId = req.params.id;
    const userId = req.session.user.user_id;
    const { title, content } = req.body;

    try {
        const result = await pool.query(
            `UPDATE blogs
             SET title = $1, body = $2
             WHERE blog_id = $3 AND creator_user_id = $4`,
            [title, content, postId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).send("Post not found or you cannot edit this post.");
        }

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error updating the post.");
    }
});


app.post("/posts", async (req, res) => {
    console.log("NEW BLOG POST FORM DATA:", req.body);

    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const { title, content, category } = req.body;
    const user = req.session.user;

    try {
        const result = await pool.query(
            `INSERT INTO blogs
                (creator_name, creator_user_id, title, body, category)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [user.name, user.user_id, title, content, category]
        );

        console.log("BLOG POST SAVED:", result.rows[0]);

        res.redirect("/");
    } catch (error) {
        console.error("ERROR SAVING BLOG POST:", error);
        res.status(500).send("Error creating blog post. Check the terminal for details.");
    }
});


app.post("/posts/:id/delete", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const postId = req.params.id;
    const userId = req.session.user.user_id;

    try {
        const result = await pool.query(
            "DELETE FROM blogs WHERE blog_id = $1 AND creator_user_id = $2",
            [postId, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).send("Post not found or you cannot delete this post.");
        }

        res.redirect("/");
    } catch (error) {
        console.error(error);
        res.status(500).send("Error deleting blog post.");
    }
});



app.post("/signout", (req, res) => {
    req.session.destroy((error) => {
        if (error) {
            console.error(error);
            return res.status(500).send("Error signing out.");
        }

        res.redirect("/");
    });
});



app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});