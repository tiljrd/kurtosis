import { err, ok, Result } from 'neverthrow';
import {newExecCommandArgs, newUpdateServiceArgs} from '../constructor_calls';
import {
    ExecCommandArgs,
    ServiceStatus,
    Container,
    UpdateServiceArgs,
    ServiceInfo, Port
} from '../../kurtosis_core_rpc_api_bindings/api_container_service_pb';
import type { PortSpec } from './port_spec';
import type { ServiceName, ServiceUUID } from './service';
import { GenericApiContainerClient } from '../enclaves/generic_api_container_client';

// Docs available at https://docs.kurtosis.com/sdk/#servicecontext
export class ServiceContext {
    constructor(
        private readonly client: GenericApiContainerClient,
        private readonly serviceName: ServiceName,
        private readonly serviceUuid: ServiceUUID,
        private readonly privateIpAddress: string,
        private readonly privatePorts: Map<string, PortSpec>,
        private readonly publicIpAddress: string,
        private readonly publicPorts: Map<string, PortSpec>,
        private readonly serviceStatus: ServiceStatus,
        private readonly container: Container | undefined,
    ) {}

    // Docs available at https://docs.kurtosis.com/sdk/#getservicename---servicename
    public getServiceName(): ServiceName {
        return this.serviceName;
    }

    // Docs available at https://docs.kurtosis.com/sdk/#getserviceuuid---serviceuuid
    public getServiceUUID(): ServiceUUID {
        return this.serviceUuid;
    }

    // Docs available at https://docs.kurtosis.com/sdk/#getprivateipaddress---string
    public getPrivateIPAddress(): string {
        return this.privateIpAddress
    }

    // Docs available at https://docs.kurtosis.com/sdk/#getprivateports---mapportid-portspec
    public getPrivatePorts(): Map<string, PortSpec> {
        return this.privatePorts
    }

    // Docs available at https://docs.kurtosis.com/sdk/#getmaybepublicipaddress---string
    public getMaybePublicIPAddress(): string {
        return this.publicIpAddress
    }

    // Docs available at https://docs.kurtosis.com/sdk/#getpublicports---mapportid-portspec
    public getPublicPorts(): Map<string, PortSpec> {
        return this.publicPorts
    }

    // Docs available at https://docs.kurtosis.com/sdk/#getservicestatus---servicestatus
    public getServiceStatus(): ServiceStatus {
        return this.serviceStatus
    }

    // Docs available at https://docs.kurtosis.com/sdk/#getcontainer---container
    public getContainer(): Container | undefined {
        return this.container
    }

    // Docs available at https://docs.kurtosis.com/sdk/#execcommandliststring-command---int-exitcode-string-logs
    public async execCommand(command: string[]): Promise<Result<[number, string], Error>> {
        const execCommandArgs: ExecCommandArgs = newExecCommandArgs(this.serviceName, command);

        const execCommandResponseResult = await this.client.execCommand(execCommandArgs)
        if(execCommandResponseResult.isErr()){
            return err(execCommandResponseResult.error)
        }

        const execCommandResponse = execCommandResponseResult.value
        return ok([execCommandResponse.getExitCode(), execCommandResponse.getLogOutput()]);
    }

    public async updateService(
        imageName: string,
        entrypointArgs: string[],
        cmdArgs: string[],
        envVars: Map<string, string>,
        privatePorts: Map<string, Port>,
        filesArtifactsMounts: Map<string, string[]>
    ): Promise<Result<[boolean, ServiceInfo], Error>> {
        const updateServiceArgs: UpdateServiceArgs = newUpdateServiceArgs(
            this.serviceName,
            imageName,
            entrypointArgs,
            cmdArgs,
            envVars,
            privatePorts,
            filesArtifactsMounts
        );

        const updateServiceResponseResult = await this.client.updateService(updateServiceArgs);
        if (updateServiceResponseResult.isErr()) {
            return err(updateServiceResponseResult.error);
        }

        const updateCommandResponse = updateServiceResponseResult.value;
        // If there's an error message in the response, consider it a failure
        const errorMessage = updateCommandResponse.getErrorMessage();
        if (errorMessage && errorMessage.trim() !== "") {
            return err(new Error(`UpdateService failed for service '${this.serviceName}': ${errorMessage}`));
        }

        const updatedServiceInfo = updateCommandResponse.getUpdatedServiceInfo();
        if (!updatedServiceInfo) {
            return err(new Error(`UpdateService did not return updated service info for service '${this.serviceName}'`));
        }

        return ok([updateCommandResponse.getSuccess(), updatedServiceInfo]);
    }
}
