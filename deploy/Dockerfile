# Build a static binary, run it in a small image. No `go run` at container start.
FROM golang:1.22 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /sshfolio .

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=build /sshfolio /app/sshfolio
CMD ["/app/sshfolio"]
