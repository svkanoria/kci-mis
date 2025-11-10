# KCI MIS

Runs in containers - one for the app, one for the DB.

## Getting Started

Create an .env file with the following variables:

    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=postgres
    POSTGRES_DB=kci-mis
    HOST_DB_PORT=5433

I recommend the above values since they work well with containerized Postgres. `HOST_DB_PORT` exposes the postgres service on port 5433 of the host machine. I have used 5433 because host machines will probably have a natively installed Postgres at the default port 5432.

### Start the app and DB containers

    $ docker compose up dev

OR

    $ docker compose up prod

### Load CSV data into the database

Download the sales register data from SAP, and convert it into a CSV file using Excel.

Upload the data using our data ingestor service:

    $ npm run data-ingestor -- file/path/to.csv
