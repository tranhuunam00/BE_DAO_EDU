<!--  setting public minio -->

mc alias set local http://localhost:9005 [EMAIL_ADDRESS] [PASSWORD] 
mc anonymous set download local/edu
mc anonymous get local/edu
