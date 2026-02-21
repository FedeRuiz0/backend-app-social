const express = require("express");
const cors = require("cors")
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
};

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

app.get("/communities", async (req, res) => {
  try {
    const communities = await prisma.community.findMany({
      orderBy: { createdAt: "desc" },
    })

    res.json(communities)
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo comunidades" })
  }
})

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

if (!email || !password) {
  return res.status(400).json({ error: "Faltan datos" });
}

const user = await prisma.user.findUnique({
  where: { email },
});

    if (!user) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    // 🔥 Crear token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      message: "Login exitoso 🚀",
      token,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en login" });
  }
});

// Crear usuario con password encriptada
app.post("/users", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando usuario" });
  }
});

app.post("/communities", async (req, res) => {
  try {
    const { name, description } = req.body

    const community = await prisma.community.create({
      data: {
        name,
        description,
      },
    })

    res.json(community)
  } catch (error) {
    res.status(500).json({ error: "Error creando comunidad" })
  }
})

app.post("/communities/:id/join", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId
    const communityId = req.params.id

    // 1️⃣ Verificar que la comunidad exista
    const community = await prisma.community.findUnique({
      where: { id: communityId },
    })

    if (!community) {
      return res.status(404).json({ error: "Comunidad no encontrada" })
    }

    // 2️⃣ Verificar si ya es miembro
    const existingMembership = await prisma.communityMember.findUnique({
      where: {
        userId_communityId: {
          userId,
          communityId,
        },
      },
    })

    if (existingMembership) {
      return res.status(400).json({ error: "Ya eres miembro" })
    }

    // 3️⃣ Crear membresía
    const membership = await prisma.communityMember.create({
      data: {
        userId,
        communityId,
      },
    })

    res.json({
      message: "Te uniste a la comunidad",
      membership,
    })
  } catch (error) {
    res.status(500).json({ error: "Error uniéndose a comunidad" })
  }
})

app.post("/posts", authMiddleware, async (req, res) => {
  try {
    const { content, imageUrl } = req.body;

    const post = await prisma.post.create({
      data: {
        content,
        imageUrl,
        authorId: req.userId,
      },
    });

    res.json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando post" });
  }
});

app.post("/users/:userId/follow", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // No puedes seguirte a ti mismo
    if (userId === req.userId) {
      return res.status(400).json({ error: "No puedes seguirte a ti mismo" });
    }

    await prisma.follow.create({
      data: {
        followerId: req.userId,
        followingId: userId,
      },
    });

    res.json({ message: "Ahora estás siguiendo a este usuario 👥" });

  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Ya sigues a este usuario o error" });
  }
});

app.post("/posts/:postId/like", authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;

    const like = await prisma.like.create({
      data: {
        userId: req.userId,
        postId: postId,
      },
    });

    res.json({ message: "Like agregado ❤️" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: "Ya le diste like o error" });
  }
});

app.get("/communities/:id/feed", async (req, res) => {
  try {
    const communityId = req.params.id

    const posts = await prisma.post.findMany({
      where: {
        communityId,
      },
      include: {
        author: true,
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    res.json(posts)
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo feed" })
  }
})

app.listen(5000, () => {
  console.log("Servidor corriendo en http://localhost:5000")
})