FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /dotnet
EXPOSE 8080
COPY ./Release/web-netcore .
ENTRYPOINT ["dotnet", "web-netcore.dll"]
