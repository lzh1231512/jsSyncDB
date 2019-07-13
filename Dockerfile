FROM microsoft/aspnetcore:2.2
WORKDIR /dotnet
EXPOSE 5004
COPY ./Release/web-netcore .
ENTRYPOINT ["dotnet", "web-netcore.dll"]
