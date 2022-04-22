FROM node
WORKDIR /schoolutilites-frontend
COPY . .
CMD ["node", "untisAPIStundenPlan.js"]