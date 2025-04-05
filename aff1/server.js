
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 8080;

const BASE_URL = "http://20.244.56.144/evaluation-service";

function loadAccessToken() {
    try {
        const data = fs.readFileSync('auth_token.json', 'utf-8');
        const tokenData = JSON.parse(data);
        return tokenData.access_token;
    } catch (err) {
        console.error("Error loading access token:", err.message);
        return null;
    }
}

const ACCESS_TOKEN = loadAccessToken();

async function getApiData(endpoint) {
    try {
        const res = await axios.get(`${BASE_URL}/${endpoint}`, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`
            }
        });
        return res.data;
    } catch (err) {
        console.error(`Error fetching ${endpoint}:`, err.message);
        return null;
    }
}

async function getPostComments(postId) {
    return await getApiData(`posts/${postId}/comments`);
}

app.get('/users', async (req, res) => {
    const usersData = await getApiData("users");
    if (!usersData) return res.status(500).json({ error: "Failed to fetch users" });

    const userPostCounts = {};
    for (const [userId, username] of Object.entries(usersData.users || {})) {
        const postsData = await getApiData(`users/${userId}/posts`);
        const postCount = postsData?.posts?.length || 0;
        userPostCounts[userId] = { name: username, posts: postCount };
    }

    const sortedUsers = Object.entries(userPostCounts)
        .sort((a, b) => b[1].posts - a[1].posts)
        .slice(0, 5);

    const result = sortedUsers.map(([id, info]) => ({
        id,
        name: info.name,
        posts: info.posts
    }));

    res.json({ top_users: result });
});

app.get('/posts', async (req, res) => {
    const postType = req.query.type || 'latest';
    if (!['latest', 'popular'].includes(postType)) {
        return res.status(400).json({ error: "Invalid post type. Use 'latest' or 'popular'" });
    }

    const usersData = await getApiData("users");
    if (!usersData) return res.status(500).json({ error: "Failed to fetch users" });

    let allPosts = [];
    for (const [userId, username] of Object.entries(usersData.users || {})) {
        const postsData = await getApiData(`users/${userId}/posts`);
        if (postsData?.posts) {
            postsData.posts.forEach(post => {
                post.username = username;
                allPosts.push(post);
            });
        }
    }

    if (postType === 'popular') {
        for (let post of allPosts) {
            const commentsData = await getPostComments(post.id);
            post.comment_count = commentsData?.comments?.length || 0;
        }
        const maxComments = Math.max(...allPosts.map(p => p.comment_count || 0));
        const popularPosts = allPosts.filter(p => p.comment_count === maxComments);
        return res.json({ popular_posts: popularPosts });
    } else {
        const latestPosts = allPosts.sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);
        return res.json({ latest_posts: latestPosts });
    }
});

app.get('/comments/:postId', async (req, res) => {
    const { postId } = req.params;
    const commentsData = await getPostComments(postId);
    if (!commentsData) return res.status(500).json({ error: `Failed to fetch comments for post ${postId}` });

    res.json(commentsData);
});

app.listen(PORT, () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
