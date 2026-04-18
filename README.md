# Typing Duel (Real-Time Multiplayer)

A lightweight browser-based real-time multiplayer typing game where two players compete to type the same text the fastest.

## Goal

This project is focused on learning:
- Real-time browser multiplayer communication
- WebSocket-based client/server interaction
- Simple game state synchronization
- Server-side validation of results

## Game Concept

- Two players are matched in a room
- Both receive the same text prompt
- The first player to correctly complete the text wins
- The server determines the winner

## Tech Stack

Backend:
- Python (FastAPI or websockets)
- WebSockets for real-time communication

Frontend:
- HTML, CSS, JavaScript
- Simple browser-based UI

## Flow

1. Player connects to server
2. Players are matched into a room
3. Both receive the same text
4. Timer starts when game begins
5. Players type in real time
6. Server validates completion and decides winner

## Status

Early-stage learning project
