docker stop novaroute
docker rm novaroute
docker build -t novaroute .
docker run -d --name novaroute -p 20128:20128 --env-file .env -v novaroute-data:/app/data novaroute