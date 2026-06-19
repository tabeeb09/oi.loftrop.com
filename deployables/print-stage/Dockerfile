FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    python3 \
    xz-utils \
    file \
    libglib2.0-0 \
    libgtk-3-0 \
    libwebkit2gtk-4.0-37 \
    libwebkit2gtk-4.1-0 \
    libgl1 \
    libglu1-mesa \
    libdbus-1-3 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    libxrandr2 \
    libxfixes3 \
    libxi6 \
    libxkbcommon0 \
    libfontconfig1 \
    libsm6 \
    libice6 \
    libmspack0 \
    libnss3 \
    libasound2 \
  && rm -rf /var/lib/apt/lists/*

ARG ORCA_APPIMAGE_URL=https://github.com/OrcaSlicer/OrcaSlicer/releases/download/v2.3.0/OrcaSlicer_Linux_AppImage_V2.3.0.AppImage
RUN mkdir -p /opt/orca-slicer \
  && curl -fsSL "$ORCA_APPIMAGE_URL" -o /opt/orca-slicer/OrcaSlicer.AppImage \
  && chmod +x /opt/orca-slicer/OrcaSlicer.AppImage \
  && cd /opt/orca-slicer \
  && ./OrcaSlicer.AppImage --appimage-extract \
  && rm -f /opt/orca-slicer/OrcaSlicer.AppImage

COPY orca-profiles /opt/orca-profiles

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-p", "3000"]
