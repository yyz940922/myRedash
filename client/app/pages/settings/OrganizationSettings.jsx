import React from "react";
import PropTypes from "prop-types";
import { isEmpty, join, get } from "lodash";

import Alert from "antd/lib/alert";
import Button from "antd/lib/button";
import Form from "antd/lib/form";
import Input from "antd/lib/input";
import Select from "antd/lib/select";
import Checkbox from "antd/lib/checkbox";
import Tooltip from "antd/lib/tooltip";
import routeWithUserSession from "@/components/ApplicationArea/routeWithUserSession";
import LoadingState from "@/components/items-list/components/LoadingState";

import { clientConfig } from "@/services/auth";
import recordEvent from "@/services/recordEvent";
import OrgSettings from "@/services/organizationSettings";
import HelpTrigger from "@/components/HelpTrigger";
import wrapSettingsTab from "@/components/SettingsWrapper";
import DynamicComponent from "@/components/DynamicComponent";

const Option = Select.Option;

class OrganizationSettings extends React.Component {
  static propTypes = {
    onError: PropTypes.func,
  };

  static defaultProps = {
    onError: () => {},
  };

  state = {
    settings: {},
    formValues: {},
    loading: true,
    submitting: false,
  };

  componentDidMount() {
    recordEvent("view", "page", "org_settings");
    OrgSettings.get()
      .then(response => {
        const settings = get(response, "settings");
        this.setState({ settings, formValues: { ...settings }, loading: false });
      })
      .catch(error => this.props.onError(error));
  }

  disablePasswordLoginToggle = () =>
    !(clientConfig.googleLoginEnabled || clientConfig.ldapLoginEnabled || this.state.formValues.auth_saml_enabled);

  handleSubmit = e => {
    e.preventDefault();
    if (!this.state.submitting) {
      this.setState({ submitting: true });
      OrgSettings.save(this.state.formValues)
        .then(response => {
          const settings = get(response, "settings");
          this.setState({ settings, formValues: { ...settings } });
        })
        .catch(error => this.props.onError(error))
        .finally(() => this.setState({ submitting: false }));
    }
  };

  handleChange = (name, value) => {
    this.setState(
      prevState => ({ formValues: Object.assign(prevState.formValues, { [name]: value }) }),
      () => {
        if (this.disablePasswordLoginToggle() && !this.state.formValues.auth_password_login_enabled) {
          this.handleChange("auth_password_login_enabled", true);
        }
      }
    );
  };

  renderGoogleLoginOptions() {
    const { formValues } = this.state;
    return (
      <React.Fragment>
        <h4>Google Login</h4>
        <Form.Item label="允许 Google Apps Domains">
          <Select
            mode="tags"
            value={formValues.auth_google_apps_domains}
            onChange={value => this.handleChange("auth_google_apps_domains", value)}
          />
          {!isEmpty(formValues.auth_google_apps_domains) && (
            <Alert
              message={
                <p>
                  可以用<strong>{join(formValues.auth_google_apps_domains, ", ")}</strong>谷歌账户注册新用户；
                  没有注册而直接用谷歌账户登陆，将会自动创建一个默认角色用户。
                </p>
              }
              className="m-t-15"
            />
          )}
        </Form.Item>
      </React.Fragment>
    );
  }

  renderSAMLOptions() {
    const { formValues } = this.state;
    return (
      <React.Fragment>
        <h4>SAML</h4>
        <Form.Item>
          <Checkbox
            name="auth_saml_enabled"
            checked={formValues.auth_saml_enabled}
            onChange={e => this.handleChange("auth_saml_enabled", e.target.checked)}>
            SAML 认证启用
          </Checkbox>
        </Form.Item>
        {formValues.auth_saml_enabled && (
          <div>
            <Form.Item label="SAML Metadata URL">
              <Input
                value={formValues.auth_saml_metadata_url}
                onChange={e => this.handleChange("auth_saml_metadata_url", e.target.value)}
              />
            </Form.Item>
            <Form.Item label="SAML Entity ID">
              <Input
                value={formValues.auth_saml_entity_id}
                onChange={e => this.handleChange("auth_saml_entity_id", e.target.value)}
              />
            </Form.Item>
            <Form.Item label="SAML NameID Format">
              <Input
                value={formValues.auth_saml_nameid_format}
                onChange={e => this.handleChange("auth_saml_nameid_format", e.target.value)}
              />
            </Form.Item>
          </div>
        )}
      </React.Fragment>
    );
  }

  renderGeneralSettings() {
    const { formValues } = this.state;
    return (
      <React.Fragment>
        <h3 className="m-t-0">参数</h3>
        <hr />
        <Form.Item label="日期格式">
          <Select
            value={formValues.date_format}
            onChange={value => this.handleChange("date_format", value)}
            data-test="DateFormatSelect">
            {clientConfig.dateFormatList.map(dateFormat => (
              <Option key={dateFormat}>{dateFormat}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item label="时间格式">
          <Select
            value={formValues.time_format}
            onChange={value => this.handleChange("time_format", value)}
            data-test="TimeFormatSelect">
            {clientConfig.timeFormatList.map(timeFormat => (
              <Option key={timeFormat}>{timeFormat}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item label="图表视图(Chart)">
          <Checkbox
            name="hide_plotly_mode_bar"
            checked={formValues.hide_plotly_mode_bar}
            onChange={e => this.handleChange("hide_plotly_mode_bar", e.target.checked)}>
            隐藏绘图模式栏
          </Checkbox>
        </Form.Item>
        <Form.Item label="特征">
          <Checkbox
            name="feature_show_permissions_control"
            checked={formValues.feature_show_permissions_control}
            onChange={e => this.handleChange("feature_show_permissions_control", e.target.checked)}>
            启用查询报表支持多拥有者模式
          </Checkbox>
        </Form.Item>
        <Form.Item>
          <Checkbox
            name="send_email_on_failed_scheduled_queries"
            checked={formValues.send_email_on_failed_scheduled_queries}
            onChange={e => this.handleChange("send_email_on_failed_scheduled_queries", e.target.checked)}>
            查询后台执行调度失败时，邮件通知创建人
          </Checkbox>
        </Form.Item>
        <Form.Item>
          <Checkbox
            name="multi_byte_search_enabled"
            checked={formValues.multi_byte_search_enabled}
            onChange={e => this.handleChange("multi_byte_search_enabled", e.target.checked)}>
            查询报表支持多字节语言检索(中文、日文、韩文，速度较慢)
          </Checkbox>
        </Form.Item>
        <DynamicComponent name="BeaconConsentSetting">
          <Form.Item
            label={
              <>
                匿名共享使用统计数据 <HelpTrigger type="USAGE_DATA_SHARING" />
              </>
            }>
            <Checkbox
              name="beacon_consent"
              checked={formValues.beacon_consent}
              onChange={e => this.handleChange("beacon_consent", e.target.checked)}>
              自动发送使用统计数据，帮助Redash完善产品
            </Checkbox>
          </Form.Item>
        </DynamicComponent>
      </React.Fragment>
    );
  }

  renderAuthSettings() {
    const { settings, formValues } = this.state;
    return (
      <React.Fragment>
        <h3 className="m-t-0">
          用户认证 <HelpTrigger type="AUTHENTICATION_OPTIONS" />
        </h3>
        <hr />
        {!settings.auth_password_login_enabled && (
          <Alert
            message="用户名密码登陆方式已禁用，仅支持SSO集成认证方式登陆。"
            type="warning"
            className="m-t-15 m-b-15"
          />
        )}
        <Form.Item>
          <Checkbox
            checked={formValues.auth_password_login_enabled}
            disabled={this.disablePasswordLoginToggle()}
            onChange={e => this.handleChange("auth_password_login_enabled", e.target.checked)}>
            <Tooltip
              title={
                this.disablePasswordLoginToggle()
                  ? "只有用户启用了其它登陆认证，才可以取消用户名密码登陆方式。"
                  : null
              }
              placement="right">
              用户名密码登陆方式
            </Tooltip>
          </Checkbox>
        </Form.Item>
        {clientConfig.googleLoginEnabled && this.renderGoogleLoginOptions()}
        {this.renderSAMLOptions()}
      </React.Fragment>
    );
  }

  render() {
    const { loading, submitting } = this.state;
    return (
      <div className="row" data-test="OrganizationSettings">
        <div className="col-md-offset-4 col-md-4">
          {loading ? (
            <LoadingState className="" />
          ) : (
            <Form layout="vertical" onSubmit={this.handleSubmit}>
              {this.renderGeneralSettings()}
              {this.renderAuthSettings()}
              <Button className="w-100" type="primary" htmlType="submit" loading={submitting}>
                保存
              </Button>
            </Form>
          )}
        </div>
      </div>
    );
  }
}

const OrganizationSettingsPage = wrapSettingsTab(
  {
    permission: "admin",
    title: "系统设置",
    path: "settings/organization",
    order: 6,
  },
  OrganizationSettings
);

export default routeWithUserSession({
  path: "/settings/organization",
  title: "系统设置",
  render: pageProps => <OrganizationSettingsPage {...pageProps} />,
});
