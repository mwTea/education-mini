# 字帖出题器后端 — 生产镜像
# 字体/汉字数据在构建期下载并打进镜像（node_modules 里的 hanzi-writer-data 随 npm install 自动安装）
FROM node:22-slim

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 再拷代码与脚本
COPY src ./src
COPY scripts ./scripts

# 构建期下载开源字体与汉字数据（失败即构建失败，避免带病上线）
RUN bash scripts/fetch-fonts.sh && bash scripts/fetch-hanzi-data.sh

# 运行期数据目录（字帖 JSON 持久化，compose 里挂卷）
RUN mkdir -p /app/data
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
