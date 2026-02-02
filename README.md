# Scalable QR Code Generation System

A high-performance, concurrent QR code generation system designed to handle thousands of simultaneous users with real-time generation, security, and proper rate limiting.

## Features

- **High Concurrency**: Handles thousands of simultaneous users
- **Real-time Generation**: Dynamic QR code creation without conflicts
- **Security**: Unique, secure QR codes per request
- **Rate Limiting**: Prevents abuse and ensures fair usage
- **Database Storage**: Persistent storage with expiration support
- **Fast Response**: Optimized for minimal latency
- **Cross-platform**: Web and mobile API support

## Architecture

- **Backend**: Node.js with Express and clustering
- **Database**: Redis for caching + PostgreSQL for persistence
- **QR Generation**: High-performance QR code library
- **Rate Limiting**: Redis-based distributed rate limiting
- **Load Balancing**: Built-in clustering support

## Quick Start

```bash
npm install
npm run dev
```

## API Endpoints

- `POST /api/qr/generate` - Generate new QR code
- `GET /api/qr/:id` - Retrieve QR code
- `DELETE /api/qr/:id` - Delete QR code
- `GET /api/health` - Health check