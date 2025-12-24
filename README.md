# KCI MIS

Runs in containers - one for the app, one for the DB.

## Getting Started

Create an .env file with the following variables:

    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=postgres
    POSTGRES_DB=kci-mis
    HOST_DB_PORT=5433
    NEXT_PUBLIC_AG_GRID_LICENSE=your_ag_grid_license_key

I recommend the above values since they work well with containerized Postgres. `HOST_DB_PORT` exposes the postgres service on port 5433 of the host machine. I have used 5433 because host machines will probably have a natively installed Postgres at the default port 5432.

### Start the app and DB containers

    $ docker compose up dev

OR

    $ docker compose up prod

### Load CSV data into the database

Upload the data using our data ingestor service:

    $ npm run data-ingestor

### Deploying to EC2

Create an EC2 instance and SSH into it.

Create a .env file with the following variables:

    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=postgres
    POSTGRES_DB=kci-mis
    HOST_DB_PORT=5433
    NEXT_PUBLIC_AG_GRID_LICENSE=

Finally, run the `deploy.sh` script. This will install Docker etc. and set up everything for you to be able to run the app.

Before running the app for the first time, you will need to run the data ingestor script. For this, you first have to upload the data files into the EC2 instance, which can be done via `scp` (replace paths to suit):

    # Ensure correct permissions for EC2 pem file
    chmod 400 ~/Desktop/kci-mis.pem
    # Copy the files to EC2
    scp -i ~/Desktop/kci-mis.pem -r ~/Desktop/MIS/* ubuntu@13.234.76.53:/home/ubuntu/kci-mis-data
