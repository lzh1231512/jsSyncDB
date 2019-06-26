using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SQLite;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace web_netcore.Commons
{
    public class OpSqlite
    {
        private static SQLiteConnection OpenDB(String filePath)
        {
            SQLiteConnection conn;
            try
            {
                conn = new SQLiteConnection("data source=" + filePath + ";version=3;");
                conn.Open();

                SQLiteCommand cmd = conn.CreateCommand();
                cmd.CommandText = "PRAGMA table_info('t_main')"; //方法一：用DataAdapter和DataTable类，调用方法为using System.Data 
                SQLiteDataAdapter adapter = new SQLiteDataAdapter(cmd);
                DataTable table = new DataTable();
                adapter.Fill(table);
                if (table.Rows.Count==0)
                {
                    var cmd2 = new SQLiteCommand();
                    cmd2.Connection = conn;
                    StringBuilder stmt = new StringBuilder();
                    stmt.AppendLine(
                            "create table t_main(id INTEGER PRIMARY KEY autoincrement,isDelete INTEGER NOT NULL,objuuid VARCHAR(32),data VARCHAR(4000));");
                    stmt.AppendLine("create index t_main_objuuid on t_main(objuuid);");
                    stmt.AppendLine("create table t_main_temp(objuuid VARCHAR(32) PRIMARY KEY,data VARCHAR(4000));");
                    stmt.AppendLine("create table t_main_deleteHistory(newid INTEGER PRIMARY KEY,oldid INTEGER);");
                    stmt.AppendLine("create table t_quickSave(pkey varchar(200) primary key,pvalue varchar(200));");
                    String uuid = Guid.NewGuid().ToString().Replace("-", "");
                    stmt.AppendLine("insert into t_quickSave (pkey,pvalue) values('uuid','" + uuid + "');");
                    cmd2.CommandText = stmt.ToString();
                    cmd2.ExecuteNonQuery();
                }
                return conn;
            }
            catch
            {
            }
            return null;
        }

        public static List<long> SelectDelIds(long from, long to, String filePath)
        {
            var conn = OpenDB(filePath);
            if (conn == null)
                return null;
            try
            {
                SQLiteCommand cmd = conn.CreateCommand();
                cmd.CommandText = "select oldid from t_main_deleteHistory where newid >=" + from + " and newid <=" + to + ";";
                List<long> res = new List<long>();
                SQLiteDataReader sr = cmd.ExecuteReader();
                while (sr.Read())
                {
                    res.Add(sr.GetInt64(0));
                }
                return res;
            }
            finally
            {
                try
                {
                    conn.Close();
                }
                catch
                {
                }
            }
        }

        public static long? getMaxID(String filePath)
        {
            var conn = OpenDB(filePath);
            if (conn == null)
                return null;
            try
            {
                SQLiteCommand cmd = conn.CreateCommand();
                cmd.CommandText = "select max(id) maxid from t_main;";
                SQLiteDataReader sr = cmd.ExecuteReader();
                long? res = null;
                
                if (sr.Read())
                {
                    res = sr.GetInt64(0);
                }
                return res;
            }
            finally
            {
                try
                {
                    conn.Close();
                }
                catch
                {
                }
            }
        }

        public static List<DBObj> SelectDBObj(int id, int take, String filePath)
        {
            var conn = OpenDB(filePath);
            if (conn == null)
                return null;
            try
            {
                List<DBObj> res = new List<DBObj>();
                SQLiteCommand cmd = conn.CreateCommand();
                cmd.CommandText = "select id,data,isDelete,objuuid from t_main where id >=" + id + " order by id limit 0," + take + ";";
                SQLiteDataReader sr = cmd.ExecuteReader();
                while (sr.Read())
                {
                    DBObj obj = new DBObj()
                    {
                        id=sr.GetInt64(0),
                        data=sr.GetString(1),
                        isDelete=sr.GetInt32(2),
                        objuuid=sr.GetString(3)
                    };
                    res.Add(obj);
                }
                return res;
            }
            finally
            {
                try
                {
                    conn.Close();
                }
                catch
                {
                }
            }
        }

        public static long InsertDBObjLst(List<DBObj> objLst, String filePath, String localUUID, String uploadUUID,
                bool isRestore)
        {
            var conn = OpenDB(filePath);
            if (conn == null)
                return 0;

            try
            {
                long res = 0;

                String sql0 = "select a.pvalue vala,b.pvalue valb from t_quickSave a inner join t_quickSave b on a.pkey='"
                        + fzr(localUUID) + "' and b.pkey='" + fzr(localUUID) + "_0';";
                var stmt0 = conn.CreateCommand();
                stmt0.CommandText = sql0;
                var rs0 = stmt0.ExecuteReader();
                if (rs0.Read())
                {
                    if (uploadUUID==(rs0.GetString(0)))
                    {
                        res = long.Parse(rs0.GetString(1));
                    }
                }
                if (res == 0)
                {
                    using (var tra = conn.BeginTransaction())
                    {
                        for (int i = 0; i < objLst.Count; i++)
                        {
                            DBObj obj = objLst[i];
                            String sql = "";
                            if (obj.isDelete == 1)
                            {
                                sql += "delete from t_main_temp where objuuid='" + fzr(obj.objuuid) + "';";
                                sql += "insert into t_main_temp(objuuid,data) select objuuid,data from t_main where objuuid='"
                                        + fzr(obj.objuuid) + "';";
                            }
                            if (!isRestore)
                            {
                                sql += "insert into t_main(isDelete,objuuid,data) values(" + obj.isDelete + ",'"
                                        + fzr(obj.objuuid) + "','" + fzr(obj.data) + "');";
                            }
                            else
                            {
                                sql += "insert into t_main(id,isDelete,objuuid,data) values(" + obj.id + ","
                                        + obj.isDelete + ",'" + fzr(obj.objuuid) + "','" + fzr(obj.data) + "');";
                            }
                            if (obj.isDelete == 1)
                            {
                                sql += "update t_main set data=(select data from t_main_temp where objuuid='"
                                        + fzr(obj.objuuid) + "') where objuuid='" + fzr(obj.objuuid) + "';";
                                sql += "delete from t_main_temp where objuuid='" + fzr(obj.objuuid) + "';";
                            }
                            sql += "select last_insert_rowid()";
                            var stmt = conn.CreateCommand();
                            stmt.CommandText = sql;

                            var rs = stmt.ExecuteReader();
                            if (rs.Read())
                            {
                                long newID = rs.GetInt64(0);
                                if (res == 0)
                                    res = newID;
                                sql = "insert into t_main_deleteHistory(newid,oldid) select " + newID
                                        + ",id from t_main where objuuid='" + fzr(obj.objuuid) + "' and id!=" + newID
                                        + ";";
                                sql += "delete from t_main where objuuid='" + fzr(obj.objuuid) + "' and id!=" + newID
                                        + ";";

                                var stmt3 = conn.CreateCommand();
                                stmt3.CommandText = sql;
                                stmt3.ExecuteNonQuery();
                            }
                        }
                        String sql2 = "delete from t_quickSave where  pkey='" + fzr(localUUID) + "';";
                        sql2 += "delete from t_quickSave where  pkey='" + fzr(localUUID) + "_0';";
                        sql2 += "insert into t_quickSave (pkey,pvalue) values('" + fzr(localUUID) + "','" + fzr(uploadUUID)
                                + "');";
                        sql2 += "insert into t_quickSave (pkey,pvalue) values('" + fzr(localUUID) + "_0','" + res + "');";
                        var stmt2 = conn.CreateCommand();
                        stmt2.CommandText = sql2;
                        stmt2.ExecuteNonQuery();
                        tra.Commit();
                    }
                }
                return res;
            }
            finally
            {
                try
                {
                    conn.Close();
                }
                catch
                {
                }
            }
        }

        public static String getQuickSaveValue(String key, String filePath)
        {
            var conn = OpenDB(filePath);
            if (conn == null)
                return null;
            try
            {
                var stmt = conn.CreateCommand();
                String res = null;
                stmt.CommandText = "select pvalue from t_quickSave where pkey ='" + fzr(key) + "';";
                var rs = stmt.ExecuteReader();
                if (rs.Read())
                {
                    res = rs.GetString(0);
                }
                return res;
            }
            finally
            {
                try
                {
                    conn.Close();
                }
                catch
                {
                }
            }
        }

        public static bool QuickSave(String key, String value, String filePath)
        {
            var conn = OpenDB(filePath);
            if (conn == null)
                return false;
            try
            {
                using (var tra = conn.BeginTransaction())
                {
                    String sql = "delete from t_quickSave where  pkey='" + fzr(key) + "';";
                    sql += "insert into t_quickSave (pkey,pvalue) values('" + fzr(key) + "','" + fzr(value) + "');";
                    var stmt = conn.CreateCommand();
                    stmt.CommandText = sql;
                    stmt.ExecuteNonQuery();
                    tra.Commit();
                }
                return true;
            }
            finally
            {
                try
                {
                    conn.Close();
                }
                catch
                {
                }
            }
        }

        private static String fzr(String str)
        {
            if (str == null)
                return "";
            return str.Replace("'", "''");
        }
    }
}
