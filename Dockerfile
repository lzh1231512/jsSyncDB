FROM microsoft/aspnetcore:2.2
WORKDIR /dotnet
EXPOSE 5004
COPY ./jsSyncDB/Release/web-netcore .
ENTRYPOINT ["dotnet", "web-netcore.dll"]
