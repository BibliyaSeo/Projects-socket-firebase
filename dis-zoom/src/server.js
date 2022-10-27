import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});

instrument(io, {
  auth: false,
});

const publicRooms = () => {
  const { sids, rooms } = io.sockets.adapter;
  /* 다르게 적는 방법
  const { sockets: { adapter: { sids, rooms } } } = io;
  const sids = io.sockets.adapter.sids;
  const rooms = io.sockets.adapter.rooms;
  */
  const publicRooms = [];
  // sids => 개인방 rooms => 개인방, 공개방 room > sids
  // if 공개방만 얻고 싶다면 rooms에서 sids를 빼면 됨
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
};

const countRoom = (roomName) => {
  return io.sockets.adapter.rooms.get(roomName)?.size;
};

io.on("connection", (socket) => {
  socket["nickname"] = "Anon";
  socket.onAny((event) => {
    console.log(io.sockets.adapter);
    console.log(`Socket Event: ${event}`);
  });
  socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    done();
    socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
    io.sockets.emit("room_change", publicRooms());
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
    );
  });
  socket.on("disconnect", () => {
    io.sockets.emit("room_change", publicRooms());
  });
  socket.on("new_message", (msg, roomName, done) => {
    socket.to(roomName).emit("new_message", `${socket.nickname}: ${msg}`);
    done();
  });
});

server.listen(3000, () => console.log(`Listening on http://localhost:3000`));
